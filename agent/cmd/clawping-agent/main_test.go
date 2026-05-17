package main

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/locuno/clawping/agent/internal/config"
)

type fakeStarter struct {
	err error
}

func (f fakeStarter) Start(context.Context) error { return f.err }

func restoreMainDeps() func() {
	origLoad := loadConfig
	origNew := newHeartbeatManager
	origNotify := notifyContext
	origExit := exitProcess
	return func() {
		loadConfig = origLoad
		newHeartbeatManager = origNew
		notifyContext = origNotify
		exitProcess = origExit
	}
}

func TestRunSuccess(t *testing.T) {
	defer restoreMainDeps()()
	loadConfig = func(path string) (*config.Config, error) {
		if path != "custom.yaml" {
			t.Fatalf("unexpected config path: %s", path)
		}
		return &config.Config{DeviceName: "device"}, nil
	}
	newHeartbeatManager = func(cfg *config.Config) (heartbeatStarter, error) {
		if cfg.DeviceName != "device" {
			t.Fatalf("unexpected cfg: %#v", cfg)
		}
		return fakeStarter{}, nil
	}
	notifyContext = func(ctx context.Context, _ ...os.Signal) (context.Context, context.CancelFunc) {
		return ctx, func() {}
	}

	if code := run([]string{"-config", "custom.yaml"}); code != 0 {
		t.Fatalf("expected 0, got %d", code)
	}
}

func TestRunFlagError(t *testing.T) {
	if code := run([]string{"-bad"}); code != 2 {
		t.Fatalf("expected 2, got %d", code)
	}
}

func TestRunLoadError(t *testing.T) {
	defer restoreMainDeps()()
	loadConfig = func(string) (*config.Config, error) { return nil, errors.New("load failed") }
	if code := run(nil); code != 1 {
		t.Fatalf("expected 1, got %d", code)
	}
}

func TestRunManagerError(t *testing.T) {
	defer restoreMainDeps()()
	loadConfig = func(string) (*config.Config, error) { return &config.Config{}, nil }
	newHeartbeatManager = func(*config.Config) (heartbeatStarter, error) { return nil, errors.New("manager failed") }
	if code := run(nil); code != 1 {
		t.Fatalf("expected 1, got %d", code)
	}
}

func TestRunStartError(t *testing.T) {
	defer restoreMainDeps()()
	loadConfig = func(string) (*config.Config, error) { return &config.Config{}, nil }
	newHeartbeatManager = func(*config.Config) (heartbeatStarter, error) {
		return fakeStarter{err: errors.New("start failed")}, nil
	}
	notifyContext = func(ctx context.Context, _ ...os.Signal) (context.Context, context.CancelFunc) { return ctx, func() {} }
	if code := run(nil); code != 1 {
		t.Fatalf("expected 1, got %d", code)
	}
}

func TestRunCanceledIsSuccess(t *testing.T) {
	defer restoreMainDeps()()
	loadConfig = func(string) (*config.Config, error) { return &config.Config{}, nil }
	newHeartbeatManager = func(*config.Config) (heartbeatStarter, error) { return fakeStarter{err: context.Canceled}, nil }
	notifyContext = func(ctx context.Context, _ ...os.Signal) (context.Context, context.CancelFunc) { return ctx, func() {} }
	if code := run(nil); code != 0 {
		t.Fatalf("expected 0, got %d", code)
	}
}

func TestMainReturnsExitCode(t *testing.T) {
	defer restoreMainDeps()()
	originalArgs := os.Args
	os.Args = []string{"clawping-agent", "-config", "main.yaml"}
	defer func() { os.Args = originalArgs }()

	var exitCode int
	exitProcess = func(code int) { exitCode = code }
	loadConfig = func(path string) (*config.Config, error) {
		if path != "main.yaml" {
			t.Fatalf("unexpected config path: %s", path)
		}
		return &config.Config{}, nil
	}
	newHeartbeatManager = func(*config.Config) (heartbeatStarter, error) {
		return fakeStarter{err: context.Canceled}, nil
	}
	notifyContext = func(ctx context.Context, _ ...os.Signal) (context.Context, context.CancelFunc) {
		return ctx, func() {}
	}

	main()
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", exitCode)
	}
}
