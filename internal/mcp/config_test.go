package mcp

import (
	"strings"
	"testing"
)

// env builds a getenv function over a fixed map, so the configuration rules can
// be tested without touching the process environment.
func env(values map[string]string) func(string) string {
	return func(key string) string {
		return values[key]
	}
}

// completeEnv is the smallest environment that satisfies ParseEnv.
func completeEnv() map[string]string {
	return map[string]string{
		"MOOGO_BASE_URL":   "https://api.moogo.dev",
		"MOOGO_PROJECT_ID": "1234",
		"MOOGO_SQL_KEY":    "moogo_secret",
	}
}

func TestParseEnvSuccess(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	config, err := ParseEnv(env(values))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}

	if config.ProjectURL() != "https://api.moogo.dev/p/1234" {
		t.Errorf("ProjectURL() = %q, want the base and project id joined", config.ProjectURL())
	}
	if config.SecretKey != values["MOOGO_SQL_KEY"] {
		t.Errorf("SecretKey = %q, want %q", config.SecretKey, values["MOOGO_SQL_KEY"])
	}
	if config.Transport != TransportStdio {
		t.Errorf("Transport = %q, want %q", config.Transport, TransportStdio)
	}
}

func TestParseEnvTrimsTrailingSlash(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	values["MOOGO_BASE_URL"] = " https://api.moogo.dev/ "
	values["MOOGO_PROJECT_ID"] = " 1234 "
	values["MOOGO_SQL_KEY"] = " moogo_secret "

	config, err := ParseEnv(env(values))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}
	if config.ProjectURL() != "https://api.moogo.dev/p/1234" {
		t.Errorf("ProjectURL() = %q, want trailing slash and spaces removed", config.ProjectURL())
	}
	if config.SecretKey != "moogo_secret" {
		t.Errorf("SecretKey = %q, want surrounding spaces removed", config.SecretKey)
	}
}

func TestParseEnvMissingRequired(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		values  map[string]string
		wantMsg string
	}{
		{
			name:    "no base url",
			values:  map[string]string{"MOOGO_PROJECT_ID": "1234", "MOOGO_SQL_KEY": "moogo_secret"},
			wantMsg: "MOOGO_BASE_URL",
		},
		{
			name:    "no project id",
			values:  map[string]string{"MOOGO_BASE_URL": "https://api.moogo.dev", "MOOGO_SQL_KEY": "moogo_secret"},
			wantMsg: "MOOGO_PROJECT_ID",
		},
		{
			name:    "no sql key",
			values:  map[string]string{"MOOGO_BASE_URL": "https://api.moogo.dev", "MOOGO_PROJECT_ID": "1234"},
			wantMsg: "MOOGO_SQL_KEY",
		},
		{
			name:    "neither",
			values:  map[string]string{},
			wantMsg: "MOOGO_BASE_URL",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := ParseEnv(env(test.values))
			if err == nil {
				t.Fatal("ParseEnv() error = nil, want a required-variable error")
			}
			if !strings.Contains(err.Error(), test.wantMsg) {
				t.Errorf("ParseEnv() error = %q, want it to name %s", err, test.wantMsg)
			}
		})
	}
}

func TestParseEnvRejectsUnsupportedTransport(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	values["MOOGO_MCP_TRANSPORT"] = "carrier-pigeon"

	_, err := ParseEnv(env(values))
	if err == nil {
		t.Fatal("ParseEnv() error = nil, want the transport to be refused")
	}
	if !strings.Contains(err.Error(), "MOOGO_MCP_TRANSPORT") {
		t.Errorf("ParseEnv() error = %q, want it to name MOOGO_MCP_TRANSPORT", err)
	}
}

func TestParseEnvHTTPTransportDefaultsAddr(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	values["MOOGO_MCP_TRANSPORT"] = TransportHTTP

	config, err := ParseEnv(env(values))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}
	if config.Transport != TransportHTTP {
		t.Errorf("Transport = %q, want %q", config.Transport, TransportHTTP)
	}
	if config.Addr != defaultAddr {
		t.Errorf("Addr = %q, want %q", config.Addr, defaultAddr)
	}
}

func TestParseEnvHTTPTransportKeepsAddr(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	values["MOOGO_MCP_TRANSPORT"] = TransportHTTP
	values["MOOGO_MCP_ADDR"] = "0.0.0.0:9000"

	config, err := ParseEnv(env(values))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}
	if config.Addr != "0.0.0.0:9000" {
		t.Errorf("Addr = %q, want it left as given", config.Addr)
	}
}

func TestParseEnvStdioHasNoAddr(t *testing.T) {
	t.Parallel()

	config, err := ParseEnv(env(completeEnv()))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}
	if config.Addr != "" {
		t.Errorf("Addr = %q, want empty for stdio", config.Addr)
	}
}

func TestParseEnvStorageCredentialPair(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   map[string]string
		wantErr bool
		want    bool
	}{
		{name: "neither", want: false},
		{
			name: "both",
			value: map[string]string{
				"MOOGO_STORAGE_ACCESS_KEY_ID": "moogo_ak_1",
				"MOOGO_STORAGE_SECRET_KEY":    "moogo_sk_1",
			},
			want: true,
		},
		{
			name:    "access key id alone",
			value:   map[string]string{"MOOGO_STORAGE_ACCESS_KEY_ID": "moogo_ak_1"},
			wantErr: true,
		},
		{
			name:    "secret alone",
			value:   map[string]string{"MOOGO_STORAGE_SECRET_KEY": "moogo_sk_1"},
			wantErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			values := completeEnv()
			for key, value := range test.value {
				values[key] = value
			}

			config, err := ParseEnv(env(values))
			if test.wantErr {
				if err == nil {
					t.Fatal("ParseEnv() error = nil, want a half-set credential refused")
				}
				if !strings.Contains(err.Error(), "MOOGO_STORAGE_ACCESS_KEY_ID") {
					t.Errorf("ParseEnv() error = %q, want it to name the credential variables", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseEnv() error = %v, want nil", err)
			}
			if config.StorageEnabled() != test.want {
				t.Errorf("StorageEnabled() = %v, want %v", config.StorageEnabled(), test.want)
			}
		})
	}
}

func TestParseEnvAllowsExplicitStdio(t *testing.T) {
	t.Parallel()

	values := completeEnv()
	values["MOOGO_MCP_TRANSPORT"] = TransportStdio

	config, err := ParseEnv(env(values))
	if err != nil {
		t.Fatalf("ParseEnv() error = %v, want nil", err)
	}
	if config.Transport != TransportStdio {
		t.Errorf("Transport = %q, want %q", config.Transport, TransportStdio)
	}
}

func TestParseEnvReportsEveryProblem(t *testing.T) {
	t.Parallel()

	values := map[string]string{"MOOGO_MCP_TRANSPORT": "carrier-pigeon"}
	_, err := ParseEnv(env(values))
	if err == nil {
		t.Fatal("ParseEnv() error = nil, want an error")
	}

	message := err.Error()
	for _, want := range []string{"MOOGO_BASE_URL", "MOOGO_PROJECT_ID", "MOOGO_SQL_KEY", "MOOGO_MCP_TRANSPORT"} {
		if !strings.Contains(message, want) {
			t.Errorf("ParseEnv() error = %q, want it to mention %s", message, want)
		}
	}
}
