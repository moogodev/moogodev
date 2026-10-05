package handler

import "testing"

// TestBackupFilenameRejectsHeaderInjection is the reason the name is slugged
// rather than passed through. A project name is owner-chosen text that ends up
// in a Content-Disposition header; a quote would close the filename early and a
// newline would let the owner append headers of their own.
func TestBackupFilenameRejectsHeaderInjection(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "plain name is slugified to lowercase",
			input: "My Project",
			want:  "my_project",
		},
		{
			name:  "a quote cannot escape the header value",
			input: `evil".sqlite`,
			want:  "evil_sqlite",
		},
		{
			name:  "CRLF cannot inject a header",
			input: "a\r\nX-Injected: yes",
			want:  "ax_injected_yes",
		},
		{
			name:  "path separators cannot escape a directory",
			input: "../../etc/passwd",
			want:  "etc_passwd",
		},
		{
			name:  "a name with nothing usable falls back in the full filename",
			input: "///",
			want:  "",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			slug := slugifyProjectName(testCase.input)
			if slug != testCase.want {
				t.Fatalf("slugifyProjectName(%q) = %q, want %q", testCase.input, slug, testCase.want)
			}

			// Nothing slugified may reintroduce a character that could break
			// out of the quoted header value.
			full := backupFilename(testCase.input)
			for _, forbidden := range []string{"\r", "\n", "\"", "/", "\\"} {
				if contains(full, forbidden) {
					t.Fatalf("backupFilename(%q) = %q, which contains %q", testCase.input, full, forbidden)
				}
			}
			if !hasSuffix(full, ".sqlite") {
				t.Fatalf("backupFilename(%q) = %q, want a .sqlite extension", testCase.input, full)
			}
			// An empty slug has to fall back rather than produce a name that
			// starts with a bare separator.
			if slug == "" && !hasPrefix(full, "project_") {
				t.Fatalf("backupFilename(%q) = %q, want a project_ fallback", testCase.input, full)
			}
		})
	}
}

func contains(haystack, needle string) bool {
	return len(needle) > 0 && len(haystack) >= len(needle) &&
		func() bool {
			for i := 0; i+len(needle) <= len(haystack); i++ {
				if haystack[i:i+len(needle)] == needle {
					return true
				}
			}
			return false
		}()
}

func hasSuffix(value, suffix string) bool {
	return len(value) >= len(suffix) && value[len(value)-len(suffix):] == suffix
}

func hasPrefix(value, prefix string) bool {
	return len(value) >= len(prefix) && value[:len(prefix)] == prefix
}
