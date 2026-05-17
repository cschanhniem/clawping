package heartbeat

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/locuno/clawping/agent/internal/config"
	"github.com/locuno/clawping/agent/internal/system"
)

type fakeInfoProvider struct {
	info *system.Info
	err  error
}

func (f fakeInfoProvider) Get() (*system.Info, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.info, nil
}

func newTestManager(server string) *HeartbeatManager {
	return &HeartbeatManager{
		cfg: &config.Config{
			Server:          server,
			DeviceToken:     "cp_device_123",
			DeviceName:      "home-mini-pc",
			IntervalSeconds: 1,
			Checks:          []config.CheckConfig{},
		},
		sysInfo: fakeInfoProvider{info: &system.Info{Hostname: "mini", Uptime: 42}},
		http:    &http.Client{Timeout: time.Second},
	}
}

func TestSendHeartbeatSuccess(t *testing.T) {
	var authHeader string
	var payload map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		data, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			t.Fatal(err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	mgr := newTestManager(srv.URL + "/")
	if err := mgr.sendHeartbeat(context.Background()); err != nil {
		t.Fatal(err)
	}

	if authHeader != "Bearer cp_device_123" {
		t.Fatalf("unexpected auth header: %s", authHeader)
	}
	if payload["deviceId"] != "home-mini-pc" {
		t.Fatalf("unexpected deviceId: %v", payload["deviceId"])
	}
	checksPayload, ok := payload["checks"].([]any)
	if !ok || len(checksPayload) != 1 {
		t.Fatalf("expected heartbeat check payload, got %#v", payload["checks"])
	}
}

func TestSendHeartbeatSystemError(t *testing.T) {
	mgr := newTestManager("https://clawping.test")
	mgr.sysInfo = fakeInfoProvider{err: errors.New("system failed")}
	if err := mgr.sendHeartbeat(context.Background()); err == nil || !strings.Contains(err.Error(), "get system info") {
		t.Fatalf("expected system error, got %v", err)
	}
}

func TestSendHeartbeatMarshalError(t *testing.T) {
	original := marshalPayload
	marshalPayload = func(any) ([]byte, error) { return nil, errors.New("marshal failed") }
	defer func() { marshalPayload = original }()

	mgr := newTestManager("https://clawping.test")
	if err := mgr.sendHeartbeat(context.Background()); err == nil || !strings.Contains(err.Error(), "marshal payload") {
		t.Fatalf("expected marshal error, got %v", err)
	}
}

func TestSendHeartbeatRequestCreationError(t *testing.T) {
	mgr := newTestManager("://bad-url")
	if err := mgr.sendHeartbeat(context.Background()); err == nil || !strings.Contains(err.Error(), "create request") {
		t.Fatalf("expected request creation error, got %v", err)
	}
}

func TestSendHeartbeatSendError(t *testing.T) {
	mgr := newTestManager("http://127.0.0.1:1")
	if err := mgr.sendHeartbeat(context.Background()); err == nil || !strings.Contains(err.Error(), "send heartbeat") {
		t.Fatalf("expected send error, got %v", err)
	}
}

func TestSendHeartbeatNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()

	mgr := newTestManager(srv.URL)
	if err := mgr.sendHeartbeat(context.Background()); err == nil || !strings.Contains(err.Error(), "non-2xx") {
		t.Fatalf("expected non-2xx error, got %v", err)
	}
}

func TestRunChecksSupportedAndUnsupported(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	marker := t.TempDir() + "/backup.marker"
	if err := os.WriteFile(marker, []byte("ok"), 0o600); err != nil {
		t.Fatal(err)
	}

	mgr := newTestManager("https://clawping.test")
	mgr.cfg.Checks = []config.CheckConfig{
		{Type: "http", Name: "HTTP", URL: srv.URL},
		{Type: "disk", Name: "Disk", Path: "/"},
		{Type: "backup_freshness", Name: "Backup", Path: marker, MaxAgeHours: 24},
		{Type: "docker_container", Name: "Docker Missing Container"},
		{Type: "mystery", Name: "Mystery"},
	}

	results := mgr.runChecks(context.Background())
	if len(results) != 5 {
		t.Fatalf("expected 5 results, got %d", len(results))
	}
	if results[3].Status != "critical" || !strings.Contains(results[3].Message, "initialization failed") {
		t.Fatalf("expected docker init failure, got %#v", results[3])
	}
	if results[4].Status != "unknown" {
		t.Fatalf("expected unknown status, got %#v", results[4])
	}
}

func TestStartReturnsContextCancellation(t *testing.T) {
	mgr := newTestManager("http://127.0.0.1:1")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := mgr.Start(ctx); err != context.Canceled {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestRunLoopHandlesTicksAndCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer srv.Close()

	mgr := newTestManager(srv.URL)
	ticks := make(chan time.Time)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- mgr.runLoop(ctx, ticks) }()
	ticks <- time.Now()
	cancel()
	if err := <-done; err != context.Canceled {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestNewHeartbeatManager(t *testing.T) {
	mgr, err := NewHeartbeatManager(&config.Config{Server: "https://clawping.test", DeviceToken: "token", DeviceName: "device", IntervalSeconds: 1})
	if err != nil {
		t.Fatal(err)
	}
	if mgr.cfg.DeviceName != "device" {
		t.Fatalf("unexpected device name: %s", mgr.cfg.DeviceName)
	}
}

func TestNewHeartbeatManagerSystemInfoError(t *testing.T) {
	original := newSystemInfo
	newSystemInfo = func() (system.InfoProvider, error) {
		return nil, errors.New("system unavailable")
	}
	defer func() { newSystemInfo = original }()

	if _, err := NewHeartbeatManager(&config.Config{Server: "https://clawping.test", DeviceToken: "token", DeviceName: "device", IntervalSeconds: 1}); err == nil {
		t.Fatal("expected system info error")
	}
}

func TestRunChecksDockerSuccess(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(dir+"/docker", []byte("#!/bin/sh\necho 'running::healthy::0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	mgr := newTestManager("https://clawping.test")
	mgr.cfg.Checks = []config.CheckConfig{
		{Type: "docker_container", Name: "Docker", Container: "app"},
	}

	results := mgr.runChecks(context.Background())
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Status != "ok" {
		t.Fatalf("expected ok docker result, got %#v", results[0])
	}
}
