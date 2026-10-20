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
	Total            int64 `json:"total"`
	Limit            int   `json:"limit"`
	Offset           int   `json:"offset"`
	StorageUsedBytes int64 `json:"storage_used_bytes"`
	QuotaBytes       int64 `json:"quota_bytes"`
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

// bucketList prints the objects in a bucket.
func bucketList(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	takesValue["bucket"] = true
	takesValue["limit"] = true
	takesValue["offset"] = true
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
	offset, err := flags.number("offset")
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

	query := url.Values{}
	if bucket := flags.value("bucket"); bucket != "" {
		query.Set("bucket", bucket)
	}
	if len(flags.positional) == 1 && flags.positional[0] != "" {
		query.Set("prefix", flags.positional[0])
	}
	if limit > 0 {
		query.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		query.Set("offset", strconv.Itoa(offset))
	}

	target := config.bucketEndpoint("/")
	if encoded := query.Encode(); encoded != "" {
		target += "?" + encoded
	}

	// The raw answer is kept, not just the parsed one: --json exists so a
	// script can read fields this client does not model, and re-encoding the
	// parsed struct would drop exactly those.
	var raw json.RawMessage
	if err := newClient(config).do(ctx, http.MethodGet, target, config.storageCredential(), nil, &raw); err != nil {
		return fail(streams, err)
	}

	if flags.bools["json"] {
		printJSON(streams.Out, raw)
		return ExitOK
	}

	var page objectPage
	if err := json.Unmarshal(raw, &page); err != nil {
		return fail(streams, fmt.Errorf("parse response: %w", err))
	}

	if len(page.Objects) == 0 {
		fmt.Fprintf(streams.Out, "no objects in bucket %s\n", page.Bucket.Name)
		return ExitOK
	}

	table := tabwriter.NewWriter(streams.Out, 0, 4, 2, ' ', 0)
	fmt.Fprintln(table, "KEY\tSIZE\tTYPE\tUPDATED")
	for _, object := range page.Objects {
		fmt.Fprintf(table, "%s\t%s\t%s\t%s\n",
			object.Key, humanBytes(object.SizeBytes), object.ContentType, shortTime(object.UpdatedAt))
	}
	table.Flush()

	fmt.Fprintf(streams.Out, "\n%d of %d objects in %s · %s of %s used\n",
		len(page.Objects), page.Total, page.Bucket.Name,
		humanBytes(page.StorageUsedBytes), humanBytes(page.QuotaBytes))
	return ExitOK
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

  moogo bucket ls
  moogo bucket ls avatars/            only the keys under a prefix
  moogo bucket ls --bucket media      a bucket other than the default one
  moogo bucket ls --limit 500 --json  one bigger page, as the API returned it

Flags: --bucket, --limit, --offset, --json, --url, --storage-key-id,
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
