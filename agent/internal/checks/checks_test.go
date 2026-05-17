package checks

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/locuno/clawping/agent/internal/config"
	"github.com/shirou/gopsutil/v3/disk"
)

func cfg(overrides config.CheckConfig) config.CheckConfig { return overrides }

func TestHTTPCheckSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	r := NewHTTPCheck(cfg(config.CheckConfig{Type: "http", Name: "Test HTTP", URL: srv.URL, ExpectedStatus: 200})).Run(context.Background())
	if r.Status != "ok" {
		t.Fatalf("expected ok, got %s: %s", r.Status, r.Message)
	}
	if r.Name != "Test HTTP" {
		t.Fatalf("unexpected name: %s", r.Name)
	}
}

func TestHTTPCheckFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	r := NewHTTPCheck(cfg(config.CheckConfig{Type: "http", Name: "Fail", URL: srv.URL, ExpectedStatus: 200})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestHTTPCheckInvalidURL(t *testing.T) {
	r := NewHTTPCheck(cfg(config.CheckConfig{Type: "http", Name: "Bad", URL: "://invalid"})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestHTTPCheckConnectionRefused(t *testing.T) {
	r := NewHTTPCheck(cfg(config.CheckConfig{Type: "http", Name: "Refused", URL: "http://127.0.0.1:1", TimeoutSeconds: 2})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestHTTPCheckDefaultExpectedStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	r := NewHTTPCheck(cfg(config.CheckConfig{Type: "http", Name: "Default", URL: srv.URL})).Run(context.Background())
	if r.Status != "ok" {
		t.Fatalf("expected ok, got %s", r.Status)
	}
}

func TestHTTPCheckName(t *testing.T) {
	c := NewHTTPCheck(cfg(config.CheckConfig{Name: "My Check"}))
	if c.Name() != "My Check" {
		t.Fatalf("expected My Check, got %s", c.Name())
	}
}

func TestDiskCheckSuccess(t *testing.T) {
	r := NewDiskCheck(cfg(config.CheckConfig{Type: "disk", Name: "Root", Path: "/", WarningPercent: 80, CriticalPercent: 95})).Run(context.Background())
	if r.Status != "ok" && r.Status != "warning" && r.Status != "critical" {
		t.Fatalf("unexpected status: %s", r.Status)
	}
}

func TestDiskCheckInvalidPath(t *testing.T) {
	r := NewDiskCheck(cfg(config.CheckConfig{Type: "disk", Name: "Bad", Path: "/nonexistent/zz/yy"})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestDiskCheckThresholds(t *testing.T) {
	original := diskUsageWithContext
	t.Cleanup(func() { diskUsageWithContext = original })

	diskUsageWithContext = func(_ context.Context, _ string) (*disk.UsageStat, error) {
		return &disk.UsageStat{UsedPercent: 85}, nil
	}
	warning := NewDiskCheck(cfg(config.CheckConfig{Type: "disk", Name: "Data", Path: "/data", WarningPercent: 80, CriticalPercent: 95})).Run(context.Background())
	if warning.Status != "warning" {
		t.Fatalf("expected warning, got %s", warning.Status)
	}

	diskUsageWithContext = func(_ context.Context, _ string) (*disk.UsageStat, error) {
		return &disk.UsageStat{UsedPercent: 97}, nil
	}
	critical := NewDiskCheck(cfg(config.CheckConfig{Type: "disk", Name: "Data", Path: "/data", WarningPercent: 80, CriticalPercent: 95})).Run(context.Background())
	if critical.Status != "critical" {
		t.Fatalf("expected critical, got %s", critical.Status)
	}
}

func TestDiskCheckName(t *testing.T) {
	c := NewDiskCheck(cfg(config.CheckConfig{Name: "Data"}))
	if c.Name() != "Data" {
		t.Fatalf("expected Data, got %s", c.Name())
	}
}

func TestBackupCheckFresh(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "backup.marker")
	if err := os.WriteFile(marker, []byte("ok"), 0o600); err != nil {
		t.Fatal(err)
	}
	r := NewBackupCheck(cfg(config.CheckConfig{Type: "backup_freshness", Name: "Fresh", Path: marker, MaxAgeHours: 24})).Run(context.Background())
	if r.Status != "ok" {
		t.Fatalf("expected ok, got %s: %s", r.Status, r.Message)
	}
}

func TestBackupCheckStale(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "backup.marker")
	if err := os.WriteFile(marker, []byte("ok"), 0o600); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(marker, past, past); err != nil {
		t.Fatal(err)
	}
	r := NewBackupCheck(cfg(config.CheckConfig{Type: "backup_freshness", Name: "Stale", Path: marker, MaxAgeHours: 24})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestBackupCheckMissing(t *testing.T) {
	r := NewBackupCheck(cfg(config.CheckConfig{Type: "backup_freshness", Name: "Missing", Path: filepath.Join(t.TempDir(), "nope"), MaxAgeHours: 24})).Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestBackupCheckName(t *testing.T) {
	c := NewBackupCheck(cfg(config.CheckConfig{Name: "My Backup"}))
	if c.Name() != "My Backup" {
		t.Fatalf("expected My Backup, got %s", c.Name())
	}
}

func TestDockerCheckSuccess(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte("#!/bin/sh\necho 'running::healthy::0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	c, err := NewDockerCheck(cfg(config.CheckConfig{Type: "docker_container", Name: "OK", Container: "app"}))
	if err != nil {
		t.Fatal(err)
	}
	r := c.Run(context.Background())
	if r.Status != "ok" {
		t.Fatalf("expected ok, got %s: %s", r.Status, r.Message)
	}
}

func TestDockerCheckRequiresContainer(t *testing.T) {
	if _, err := NewDockerCheck(cfg(config.CheckConfig{Name: "Missing"})); err == nil {
		t.Fatal("expected container validation error")
	}
}

func TestDockerCheckUnhealthy(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte("#!/bin/sh\necho 'running::unhealthy::3'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	c, _ := NewDockerCheck(cfg(config.CheckConfig{Type: "docker_container", Name: "Bad", Container: "app"}))
	r := c.Run(context.Background())
	if r.Status != "warning" {
		t.Fatalf("expected warning, got %s", r.Status)
	}
}

func TestDockerCheckStopped(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte("#!/bin/sh\necho 'exited::none::5'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	c, _ := NewDockerCheck(cfg(config.CheckConfig{Type: "docker_container", Name: "Stopped", Container: "app"}))
	r := c.Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestDockerCheckCommandFailure(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte("#!/bin/sh\nexit 1\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	c, _ := NewDockerCheck(cfg(config.CheckConfig{Type: "docker_container", Name: "Fail", Container: "app"}))
	r := c.Run(context.Background())
	if r.Status != "critical" {
		t.Fatalf("expected critical, got %s", r.Status)
	}
}

func TestDockerCheckName(t *testing.T) {
	c, _ := NewDockerCheck(cfg(config.CheckConfig{Name: "Docker", Container: "test"}))
	if c.Name() != "Docker" {
		t.Fatalf("expected Docker, got %s", c.Name())
	}
}
