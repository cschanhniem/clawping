package checks

import (
	"context"
	"net/http"
	"time"

	"github.com/locuno/clawping/agent/internal/config"
)

// HTTPCheck implements Checker for local HTTP reachability.
type HTTPCheck struct {
	config config.CheckConfig
}

func NewHTTPCheck(cfg config.CheckConfig) *HTTPCheck {
	return &HTTPCheck{config: cfg}
}

func (h *HTTPCheck) Name() string {
	return h.config.Name
}

func (h *HTTPCheck) Run(ctx context.Context) CheckResult {
	timeout := 10 * time.Second
	if h.config.TimeoutSeconds > 0 {
		timeout = time.Duration(h.config.TimeoutSeconds) * time.Second
	}

	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.config.URL, nil)
	if err != nil {
		return CheckResult{
			Key:     "http",
			Name:    h.config.Name,
			Type:    "http",
			Source:  "agent",
			Status:  "critical",
			Message: "invalid target URL: " + err.Error(),
			Metadata: map[string]any{
				"target": h.config.URL,
			},
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return CheckResult{
			Key:     "http",
			Name:    h.config.Name,
			Type:    "http",
			Source:  "agent",
			Status:  "critical",
			Message: "request failed: " + err.Error(),
			Metadata: map[string]any{
				"target": h.config.URL,
			},
		}
	}
	defer resp.Body.Close()

	expected := h.config.ExpectedStatus
	if expected == 0 {
		expected = 200
	}

	status := "ok"
	message := "HTTP check passed"
	if resp.StatusCode != expected {
		status = "critical"
		message = resp.Status
	}

	return CheckResult{
		Key:     "http",
		Name:    h.config.Name,
		Type:    "http",
		Source:  "agent",
		Status:  status,
		Message: message,
		Value:   resp.StatusCode,
		Unit:    "status_code",
		Metadata: map[string]any{
			"target": h.config.URL,
		},
	}
}
