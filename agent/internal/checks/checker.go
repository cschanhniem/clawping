package checks

import (
	"context"
)

// CheckResult holds the status and message from a single check.
type CheckResult struct {
	Key      string         `json:"key"`
	Name     string         `json:"name"`
	Type     string         `json:"type"`
	Source   string         `json:"source"`
	Status   string         `json:"status"`
	Message  string         `json:"message"`
	Value    any            `json:"value,omitempty"`
	Unit     string         `json:"unit,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// Checker is the interface that must be implemented by all system checks.
type Checker interface {
	Name() string
	Run(ctx context.Context) CheckResult
}
