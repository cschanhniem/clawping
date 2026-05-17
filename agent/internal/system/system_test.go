package system

import (
	"errors"
	"runtime"
	"testing"
	"time"

	gopsutildisk "github.com/shirou/gopsutil/v3/disk"
	gopsutilmem "github.com/shirou/gopsutil/v3/mem"
)

func TestNewInfoAndGet(t *testing.T) {
	origHostname := osHostname
	osHostname = func() (string, error) { return "testhost", nil }
	defer func() { osHostname = origHostname }()

	origCPU := cpuPercent
	cpuPercent = func(_ time.Duration, _ bool) ([]float64, error) { return []float64{42.5}, nil }
	defer func() { cpuPercent = origCPU }()

	origVM := virtualMemory
	virtualMemory = func() (*gopsutilmem.VirtualMemoryStat, error) {
		return &gopsutilmem.VirtualMemoryStat{UsedPercent: 50.0}, nil
	}
	defer func() { virtualMemory = origVM }()

	origDisk := diskUsage
	diskUsage = func(_ string) (*gopsutildisk.UsageStat, error) {
		return &gopsutildisk.UsageStat{UsedPercent: 30.0}, nil
	}
	defer func() { diskUsage = origDisk }()

	origUptime := hostUptime
	hostUptime = func() (uint64, error) { return 3600, nil }
	defer func() { hostUptime = origUptime }()

	provider, err := NewInfo()
	if err != nil {
		t.Fatal(err)
	}

	info, err := provider.Get()
	if err != nil {
		t.Fatal(err)
	}

	if info.Hostname != "testhost" {
		t.Fatalf("expected hostname testhost, got %s", info.Hostname)
	}
	if info.OS != runtime.GOOS {
		t.Fatalf("expected OS %s, got %s", runtime.GOOS, info.OS)
	}
	if info.Arch != runtime.GOARCH {
		t.Fatalf("expected Arch %s, got %s", runtime.GOARCH, info.Arch)
	}
	if info.CPUUsage != 42.5 {
		t.Fatalf("expected CPU 42.5, got %.1f", info.CPUUsage)
	}
	if info.MemoryUsage != 50.0 {
		t.Fatalf("expected memory 50.0, got %.1f", info.MemoryUsage)
	}
	if info.DiskUsage != 30.0 {
		t.Fatalf("expected disk 30.0, got %.1f", info.DiskUsage)
	}
	if info.Uptime != 3600 {
		t.Fatalf("expected uptime 3600, got %d", info.Uptime)
	}
}

func TestNewInfoHostnameError(t *testing.T) {
	origHostname := osHostname
	osHostname = func() (string, error) { return "", errors.New("no hostname") }
	defer func() { osHostname = origHostname }()

	if _, err := NewInfo(); err == nil {
		t.Fatal("expected error")
	}
}

func TestGetSkipsFailingSubsystems(t *testing.T) {
	origHostname := osHostname
	osHostname = func() (string, error) { return "host", nil }
	defer func() { osHostname = origHostname }()

	origCPU := cpuPercent
	cpuPercent = func(_ time.Duration, _ bool) ([]float64, error) { return nil, errors.New("cpu error") }
	defer func() { cpuPercent = origCPU }()

	origVM := virtualMemory
	virtualMemory = func() (*gopsutilmem.VirtualMemoryStat, error) { return nil, errors.New("mem error") }
	defer func() { virtualMemory = origVM }()

	origDisk := diskUsage
	diskUsage = func(_ string) (*gopsutildisk.UsageStat, error) { return nil, errors.New("disk error") }
	defer func() { diskUsage = origDisk }()

	origUptime := hostUptime
	hostUptime = func() (uint64, error) { return 0, errors.New("uptime error") }
	defer func() { hostUptime = origUptime }()

	provider, err := NewInfo()
	if err != nil {
		t.Fatal(err)
	}

	info, err := provider.Get()
	if err != nil {
		t.Fatal(err)
	}

	if info.CPUUsage != 0 {
		t.Fatalf("expected 0 CPU, got %.1f", info.CPUUsage)
	}
	if info.MemoryUsage != 0 {
		t.Fatalf("expected 0 mem, got %.1f", info.MemoryUsage)
	}
}

func TestInfoProviderIsInterface(t *testing.T) {
	var _ InfoProvider = (*defaultInfoProvider)(nil)
}
