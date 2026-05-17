package checks

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"github.com/locuno/clawping/agent/internal/config"
)

type DockerCheck struct {
	config config.CheckConfig
}

func NewDockerCheck(cfg config.CheckConfig) (*DockerCheck, error) {
	if cfg.Container == "" {
		return nil, errors.New("container name is required")
	}
	return &DockerCheck{config: cfg}, nil
}

func (d *DockerCheck) Name() string {
	return d.config.Name
}

func (d *DockerCheck) Run(ctx context.Context) CheckResult {
	args := []string{"inspect", "--format", "{{.State.Status}}::{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}::{{.RestartCount}}", d.config.Container}
	cmd := exec.CommandContext(ctx, "docker", args...)
	output, err := cmd.Output()
	if err != nil {
		return CheckResult{
			Key:     "docker",
			Name:    d.config.Name,
			Type:    "docker_container",
			Source:  "agent",
			Status:  "critical",
			Message: "failed to inspect container: " + err.Error(),
			Metadata: map[string]any{
				"container": d.config.Container,
			},
		}
	}

	parts := strings.Split(strings.TrimSpace(string(output)), "::")
	state := ""
	health := "none"
	restarts := "0"
	if len(parts) > 0 {
		state = parts[0]
	}
	if len(parts) > 1 {
		health = parts[1]
	}
	if len(parts) > 2 {
		restarts = parts[2]
	}

	status := "ok"
	if state != "running" {
		status = "critical"
	} else if health != "none" && health != "healthy" {
		status = "warning"
	}

	return CheckResult{
		Key:     "docker",
		Name:    d.config.Name,
		Type:    "docker_container",
		Source:  "agent",
		Status:  status,
		Message: fmt.Sprintf("container=%s state=%s health=%s restarts=%s", d.config.Container, state, health, restarts),
		Metadata: map[string]any{
			"container":     d.config.Container,
			"state":         state,
			"health":        health,
			"restart_count": restarts,
		},
	}
}
