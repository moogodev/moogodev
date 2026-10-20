package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"text/tabwriter"
)

// objectPage is the answer to a listing.
//
// Mirrored from the API's documented shape rather than imported, for the same
// reason the SQL shapes are: a client that agrees with the server's structs
// stops noticing when the two drift apart.
type objectPage struct {
	Success bool `json:"success"`
	Bucket  struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		ObjectCount int64  `json:"object_count"`
		SizeBytes   int64  `json:"size_bytes"`
		IsPublic    bool   `json:"is_public"`
	} `json:"bucket"`
	Objects []struct {
		Key          string `json:"key"`
		SizeBytes    int64  `json:"size_bytes"`
		ContentType  string `json:"content_type"`
		IsPublic     bool   `json:"is_public"`
		Etag         string `json:"etag"`
		CreatedAt    string `json:"created_at"`
		UpdatedAt    string `json:"updated_at"`
		LastModified string `json:"last_modified"`
	} `json:"objects"`
	Total            int64  `json:"total"`
	Limit            int    `json:"limit"`
	NextCursor       string `json:"next_cursor"`
	StorageUsedBytes int64  `json:"storage_used_bytes"`
	QuotaBytes       int64  `json:"quota_bytes"`
}

// deleteResponse is the answer to a delete, in both its shapes: one object
// reports "deleted", a prefix reports "deleted_objects".
type deleteResponse struct {
	Success        bool  `json:"success"`
	Deleted        int64 `json:"deleted"`
	DeletedObjects int64 `json:"deleted_objects"`
	FreedBytes     int64 `json:"freed_bytes"`
}

// runBucket dispatches the bucket subcommands.
func runBucket(ctx context.Context, streams Streams, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(streams.Err, "moogo bucket needs a subcommand: ls or rm")
		bucketUsage(streams.Err)
		return ExitUsage
	}

	switch sub := args[0]; sub {
	case "ls", "list":
		return bucketList(ctx, streams, args[1:])
	case "rm", "remove", "delete":
		return bucketRemove(ctx, streams, args[1:])
	case "help", "-h", "--help":
		bucketUsage(streams.Out)
		return ExitOK
	default:
		fmt.Fprintf(streams.Err, "moogo: unknown bucket subcommand %q\n\n", sub)
		bucketUsage(streams.Err)
		return ExitUsage
	}
}

// maxPageSize is the largest page the object API accepts, and therefore the
// size every request of a listing that is being walked asks for. One number
// for both keeps a large bucket to a handful of requests instead of one per
// hundred objects.
const maxPageSize = 1000

// bucketList prints the objects in a bucket.
//
// It follows the listing's cursors to the end, so `ls` lists the bucket rather
// than its first hundred objects, and --limit is how much of that to print --
// not a page size. A listing stopped by --limit hands back the cursor to
// continue with.
func bucketList(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	takesValue["bucket"] = true
	takesValue["limit"] = true
	takesValue["cursor"] = true
	isBool["json"] = true

	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		bucketListUsage(streams.Out)
		return ExitOK
	}
	if len(flags.positional) > 1 {
		return fail(streams, &commandError{errors.New("usage: moogo bucket ls [prefix]")})
	}

	limit, err := flags.number("limit")
	if err != nil {
		return fail(streams, err)
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireStorage(); err != nil {
		return fail(streams, err)
	}
	client := newClient(config)
	credential := config.storageCredential()

	// The raw answers are kept beside the parsed pages: --json exists so a
	// script can read fields this client does not model, and re-encoding a
	// parsed struct would drop exactly those.
	var (
		raws    []json.RawMessage
		pages   []objectPage
		current = flags.value("cursor")
		shown   int
		last    objectPage
	)
	for {
		pageSize := maxPageSize
		if limit > 0 {
			remaining := limit - shown
			if remaining <= 0 {
				break
			}
			if remaining < pageSize {
				pageSize = remaining
			}
		}

		query := url.Values{}
		if bucket := flags.value("bucket"); bucket != "" {
			query.Set("bucket", bucket)
		}
		if len(flags.positional) == 1 && flags.positional[0] != "" {
			query.Set("prefix", flags.positional[0])
		}
		query.Set("limit", strconv.Itoa(pageSize))
		if current != "" {
			query.Set("cursor", current)
		}

		target := config.bucketEndpoint("/")
		if encoded := query.Encode(); encoded != "" {
			target += "?" + encoded
		}

		var raw json.RawMessage
		if err := client.do(ctx, http.MethodGet, target, credential, nil, &raw); err != nil {
			return fail(streams, err)
		}
		raws = append(raws, raw)

		var page objectPage
		if err := json.Unmarshal(raw, &page); err != nil {
			return fail(streams, fmt.Errorf("parse response: %w", err))
		}
		pages = append(pages, page)
		last = page
		shown += len(page.Objects)

		if page.NextCursor == "" || (limit > 0 && shown >= limit) {
			break
		}
		// A cursor that hands back itself would walk this loop for ever.
		// No server does that; a proxy replaying a cached answer might.
		if page.NextCursor == current {
			return fail(streams, errors.New("the API kept returning the same cursor"))
		}
		current = page.NextCursor
	}

	if flags.bools["json"] {
		printJSON(streams.Out, mergePages(raws))
		return ExitOK
	}

	if shown == 0 {
		fmt.Fprintf(streams.Out, "no objects in bucket %s\n", last.Bucket.Name)
		return ExitOK
	}

	table := tabwriter.NewWriter(streams.Out, 0, 4, 2, ' ', 0)
	fmt.Fprintln(table, "KEY\tSIZE\tTYPE\tUPDATED")
	for _, page := range pages {
		for _, object := range page.Objects {
			fmt.Fprintf(table, "%s\t%s\t%s\t%s\n",
				object.Key, humanBytes(object.SizeBytes), object.ContentType, shortTime(object.UpdatedAt))
		}
	}
	table.Flush()

	fmt.Fprintf(streams.Out, "\n%d of %d objects in %s · %s of %s used\n",
		shown, last.Total, last.Bucket.Name,
		humanBytes(last.StorageUsedBytes), humanBytes(last.QuotaBytes))
	if last.NextCursor != "" {
		// Only --limit stops a listing before its end, so this line is what
		// the cap looks like from the user's side of it.
		fmt.Fprintf(streams.Out, "next page: --cursor %s\n", last.NextCursor)
	}
	return ExitOK
}

// mergePages folds the pages of one listing back into the single document the
// API answers with, so --json means the same thing whether the bucket took one
// request or twenty.
//
// The pages are decoded as generic maps rather than into this client's own
// structs: fields it does not model are the reason --json exists, and they
// have to survive the fold.
func mergePages(raws []json.RawMessage) json.RawMessage {
	merged := map[string]any{"objects": []any{}}
	for _, raw := range raws {
		var page map[string]any
		if err := json.Unmarshal(raw, &page); err != nil {
			// The pages were parsed once already on the way in, so this cannot
			// be a page the API sent. Hand back what was read rather than
			// inventing an error path for a state that has none.
			return raw
		}
		if rows, ok := page["objects"].([]any); ok {
			merged["objects"] = append(merged["objects"].([]any), rows...)
		}
		for key, value := range page {
			if key == "objects" {
				continue
			}
			merged[key] = value
		}
	}
	encoded, err := json.Marshal(merged)
	if err != nil {
		return nil
	}
	return encoded
}

// bucketRemove deletes objects, or everything under a prefix.
func bucketRemove(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	takesValue["bucket"] = true
	isBool["prefix"] = true

	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		bucketRemoveUsage(streams.Out)
		return ExitOK
	}
	if len(flags.positional) == 0 {
		return fail(streams, &commandError{errors.New(
			"usage: moogo bucket rm <key> [<key>…], or moogo bucket rm --prefix <folder>")})
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireStorage(); err != nil {
		return fail(streams, err)
	}

	client := newClient(config)
	as := config.storageCredential()

	var deleted, freed int64
	for _, key := range flags.positional {
		if strings.TrimSpace(key) == "" {
			return fail(streams, &commandError{errors.New("an object key cannot be empty")})
		}

		query := url.Values{}
		if bucket := flags.value("bucket"); bucket != "" {
			query.Set("bucket", bucket)
		}
		if flags.bools["prefix"] {
			// A prefix delete is opt-in by name: a bare delete of "photos"
			// removes one object, and only ?prefix=true removes the folder.
			query.Set("prefix", "true")
		}

		target := config.bucketEndpoint("/" + escapeKey(key))
		if encoded := query.Encode(); encoded != "" {
			target += "?" + encoded
		}

		var response deleteResponse
		if err := client.do(ctx, http.MethodDelete, target, as, nil, &response); err != nil {
			return fail(streams, fmt.Errorf("%s: %w", key, err))
		}

		deleted += response.Deleted + response.DeletedObjects
		freed += response.FreedBytes
	}

	summary := fmt.Sprintf("deleted %d objects", deleted)
	if freed > 0 {
		summary += fmt.Sprintf(" and freed %s", humanBytes(freed))
	}
	fmt.Fprintln(streams.Out, summary)
	return ExitOK
}

// printJSON writes a JSON answer indented, or as it arrived when it is not
// JSON at all -- which is a state a proxy can produce and a script still has to
// see.
func printJSON(writer io.Writer, raw json.RawMessage) {
	var indented bytes.Buffer
	if err := json.Indent(&indented, raw, "", "  "); err != nil {
		writer.Write(raw)
		writer.Write([]byte("\n"))
		return
	}
	writer.Write(indented.Bytes())
	writer.Write([]byte("\n"))
}

func bucketUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo bucket — the project's object storage

Usage:
  moogo bucket ls [prefix]        list objects in a bucket
  moogo bucket rm <key...>        delete one or more objects
  moogo bucket rm --prefix <dir>  delete everything under a prefix

Bucket commands use a storage credential, not the project key:
  MOOGO_BUCKET_ACCESS_KEY_ID and MOOGO_BUCKET_SECRET_KEY
  (make one under Buckets → Access keys in the dashboard)

`)
}

func bucketListUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo bucket ls [prefix] — list objects in a bucket

  moogo bucket ls                    every object, following the pages
  moogo bucket ls avatars/           only the keys under a prefix
  moogo bucket ls --bucket media     a bucket other than the default one
  moogo bucket ls --limit 50         stop after 50 and print the cursor to go on
  moogo bucket ls --cursor <token>   continue where a listing stopped

Flags: --bucket, --limit, --cursor, --json, --url, --storage-key-id,
       --storage-key, --help
`)
}

func bucketRemoveUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo bucket rm <key...> — delete objects

  moogo bucket rm avatars/ada.png
  moogo bucket rm a.png b.png c.png
  moogo bucket rm --prefix avatars     everything under avatars/

A delete without --prefix removes one object and nothing else, which is why
the folder form has to be asked for by name.

Flags: --prefix, --bucket, --url, --storage-key-id, --storage-key, --help
`)
}
