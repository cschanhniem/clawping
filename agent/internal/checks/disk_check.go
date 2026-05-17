package checks

import (
	"context"
	"fmt"

	"github.com/locuno/clawping/agent/internal/config"
	"github.com/shirou/gopsutil/v3/disk"
)

var diskUsageWithContext = disk.UsageWithContext

type DiskCheck struct {
	config config.CheckConfig
}

func NewDiskCheck(cfg config.CheckConfig) *DiskCheck {
	return &DiskCheck{config: cfg}
}

func (d *DiskCheck) Name() string {
	return d.config.Name
}

func (d *DiskCheck) Run(ctx context.Context) CheckResult {
	usage, err := diskUsageWithContext(ctx, d.config.Path)
	if err != nil {
		return CheckResult{
			Key:     "disk",
			Name:    d.config.Name,
			Type:    "disk",
			Source:  "agent",
			Status:  "critical",
			Message: fmt.Sprintf("failed to read disk usage for %s: %v", d.config.Path, err),
			Metadata: map[string]any{
				"path": d.config.Path,
			},
		}
	}

	status := "ok"
	message := fmt.Sprintf("%s is %.1f%% full", d.config.Path, usage.UsedPercent)
	if d.config.CriticalPercent > 0 && usage.UsedPercent >= d.config.CriticalPercent {
		status = "critical"
	} else if d.config.WarningPercent > 0 && usage.UsedPercent >= d.config.WarningPercent {
		status = "warning"
	}

	return CheckResult{
		Key:     "disk",
		Name:    d.config.Name,
		Type:    "disk",
		Source:  "agent",
		Status:  status,
		Message: message,
		Value:   usage.UsedPercent,
		Unit:    "percent",
		Metadata: map[string]any{
			"path": d.config.Path,
		},
	}
}
