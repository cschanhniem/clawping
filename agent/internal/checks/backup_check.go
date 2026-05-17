package checks

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/locuno/clawping/agent/internal/config"
)

type BackupCheck struct {
	config config.CheckConfig
}

func NewBackupCheck(cfg config.CheckConfig) *BackupCheck {
	return &BackupCheck{config: cfg}
}

func (b *BackupCheck) Name() string {
	return b.config.Name
}

func (b *BackupCheck) Run(ctx context.Context) CheckResult {
	_ = ctx

	info, err := os.Stat(b.config.Path)
	if err != nil {
		return CheckResult{
			Key:     "backup",
			Name:    b.config.Name,
			Type:    "backup_freshness",
			Source:  "agent",
			Status:  "critical",
			Message: "backup marker not found: " + err.Error(),
			Metadata: map[string]any{
				"path": b.config.Path,
			},
		}
	}

	maxAge := time.Duration(b.config.MaxAgeHours) * time.Hour
	age := time.Since(info.ModTime())
	status := "ok"
	message := fmt.Sprintf("%s updated %.0f hour(s) ago", b.config.Path, age.Hours())
	if age > maxAge {
		status = "critical"
	}

	return CheckResult{
		Key:     "backup",
		Name:    b.config.Name,
		Type:    "backup_freshness",
		Source:  "agent",
		Status:  status,
		Message: message,
		Value:   int(age.Hours()),
		Unit:    "hours",
		Metadata: map[string]any{
			"path": b.config.Path,
		},
	}
}
