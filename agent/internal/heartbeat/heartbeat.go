package heartbeat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/locuno/clawping/agent/internal/checks"
	"github.com/locuno/clawping/agent/internal/config"
	"github.com/locuno/clawping/agent/internal/system"
)

var (
	marshalPayload = json.Marshal
	newSystemInfo  = system.NewInfo
)

type HeartbeatManager struct {
	cfg     *config.Config
	sysInfo system.InfoProvider
	http    *http.Client
}

func NewHeartbeatManager(cfg *config.Config) (*HeartbeatManager, error) {
	sysInfo, err := newSystemInfo()
	if err != nil {
		return nil, fmt.Errorf("create system info: %w", err)
	}
	return &HeartbeatManager{
		cfg:     cfg,
		sysInfo: sysInfo,
		http:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (m *HeartbeatManager) Start(ctx context.Context) error {
	ticker := time.NewTicker(time.Duration(m.cfg.IntervalSeconds) * time.Second)
	defer ticker.Stop()

	if err := m.sendHeartbeat(ctx); err != nil {
		fmt.Printf("initial heartbeat error: %v\n", err)
	}

	return m.runLoop(ctx, ticker.C)
}

func (m *HeartbeatManager) runLoop(ctx context.Context, ticks <-chan time.Time) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticks:
			if err := m.sendHeartbeat(ctx); err != nil {
				fmt.Printf("heartbeat error: %v\n", err)
			}
		}
	}
}

func (m *HeartbeatManager) sendHeartbeat(ctx context.Context) error {
	sys, err := m.sysInfo.Get()
	if err != nil {
		return fmt.Errorf("get system info: %w", err)
	}

	results := m.runChecks(ctx)
	results = append(results, checks.CheckResult{
		Key:     "system.online",
		Name:    "Agent Heartbeat",
		Type:    "heartbeat",
		Source:  "agent",
		Status:  "ok",
		Message: "Agent heartbeat received",
	})

	payload := map[string]any{
		"deviceId":      m.cfg.DeviceName,
		"agentVersion":  "0.1.0",
		"hostname":      sys.Hostname,
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
		"uptimeSeconds": sys.Uptime,
		"checks":        results,
	}

	data, err := marshalPayload(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	baseURL := strings.TrimRight(m.cfg.Server, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/agent/heartbeat", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.cfg.DeviceToken)

	resp, err := m.http.Do(req)
	if err != nil {
		return fmt.Errorf("send heartbeat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("non-2xx response: %d", resp.StatusCode)
	}

	return nil
}

func (m *HeartbeatManager) runChecks(ctx context.Context) []checks.CheckResult {
	results := make([]checks.CheckResult, 0, len(m.cfg.Checks))

	for _, check := range m.cfg.Checks {
		switch check.Type {
		case "http":
			results = append(results, checks.NewHTTPCheck(check).Run(ctx))
		case "disk":
			results = append(results, checks.NewDiskCheck(check).Run(ctx))
		case "backup_freshness":
			results = append(results, checks.NewBackupCheck(check).Run(ctx))
		case "docker_container":
			dockerCheck, err := checks.NewDockerCheck(check)
			if err != nil {
				results = append(results, checks.CheckResult{
					Key:     "docker",
					Name:    check.Name,
					Type:    "docker_container",
					Source:  "agent",
					Status:  "critical",
					Message: "docker check initialization failed: " + err.Error(),
				})
				continue
			}
			results = append(results, dockerCheck.Run(ctx))
		default:
			results = append(results, checks.CheckResult{
				Key:     check.Type,
				Name:    check.Name,
				Type:    check.Type,
				Source:  "agent",
				Status:  "unknown",
				Message: "unsupported check type",
			})
		}
	}

	return results
}
