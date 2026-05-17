package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadAppliesDefaultsAndParsesChecks(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent.yaml")
	err := os.WriteFile(path, []byte(`
server: https://clawping.test
device_token: cp_device_123
device_name: home-mini-pc
checks:
  - type: http
    name: Home Assistant
    url: http://127.0.0.1:8123
    expected_status: 200
`), 0o600)
	if err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}

	if cfg.IntervalSeconds != 60 {
		t.Fatalf("expected default interval 60, got %d", cfg.IntervalSeconds)
	}
	if cfg.Checks[0].Name != "Home Assistant" {
		t.Fatalf("unexpected check name: %s", cfg.Checks[0].Name)
	}
}

func TestLoadKeepsConfiguredInterval(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent.yaml")
	err := os.WriteFile(path, []byte(`
server: https://clawping.test
device_token: cp_device_123
device_name: home-mini-pc
interval_seconds: 15
`), 0o600)
	if err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}

	if cfg.IntervalSeconds != 15 {
		t.Fatalf("expected interval 15, got %d", cfg.IntervalSeconds)
	}
}

func TestLoadReportsReadAndParseErrors(t *testing.T) {
	if _, err := Load(filepath.Join(t.TempDir(), "missing.yaml")); err == nil {
		t.Fatal("expected missing file error")
	}

	path := filepath.Join(t.TempDir(), "bad.yaml")
	if err := os.WriteFile(path, []byte("server: ["), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected YAML parse error")
	}
}
