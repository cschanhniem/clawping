package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config matches the public agent.yaml contract from the product spec.
type Config struct {
	Server          string        `yaml:"server"`
	DeviceToken     string        `yaml:"device_token"`
	DeviceName      string        `yaml:"device_name"`
	IntervalSeconds int           `yaml:"interval_seconds"`
	Checks          []CheckConfig `yaml:"checks"`
}

// CheckConfig is a single agent-side check.
type CheckConfig struct {
	Type            string   `yaml:"type"`
	Name            string   `yaml:"name"`
	URL             string   `yaml:"url"`
	Path            string   `yaml:"path"`
	Container       string   `yaml:"container"`
	ExpectedStatus  int      `yaml:"expected_status"`
	TimeoutSeconds  int      `yaml:"timeout_seconds"`
	WarningPercent  float64  `yaml:"warning_percent"`
	CriticalPercent float64  `yaml:"critical_percent"`
	MaxAgeHours     int      `yaml:"max_age_hours"`
	AlertOn         []string `yaml:"alert_on"`
}

// Load reads and parses the YAML configuration file at path.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config YAML: %w", err)
	}

	if cfg.IntervalSeconds <= 0 {
		cfg.IntervalSeconds = 60
	}

	return &cfg, nil
}
