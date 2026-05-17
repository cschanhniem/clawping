package system

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

var (
	osHostname    = os.Hostname
	cpuPercent    = cpu.Percent
	virtualMemory = mem.VirtualMemory
	diskUsage     = disk.Usage
	hostUptime    = host.Uptime
)

// Info holds system information.
type Info struct {
	Hostname    string  `json:"hostname"`
	OS          string  `json:"os"`
	Arch        string  `json:"arch"`
	CPUUsage    float64 `json:"cpu_usage"`
	MemoryUsage float64 `json:"memory_usage"`
	DiskUsage   float64 `json:"disk_usage"`
	Uptime      uint64  `json:"uptime_seconds"`
}

// InfoProvider provides system information.
type InfoProvider interface {
	Get() (*Info, error)
}

type defaultInfoProvider struct {
	hostname string
}

// NewInfo creates a new InfoProvider.
func NewInfo() (InfoProvider, error) {
	hostname, err := osHostname()
	if err != nil {
		return nil, fmt.Errorf("get hostname: %w", err)
	}
	return &defaultInfoProvider{hostname: hostname}, nil
}

// Get collects and returns current system information.
func (p *defaultInfoProvider) Get() (*Info, error) {
	info := &Info{
		Hostname: p.hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
	}

	// CPU usage (average over 1 second)
	cpuUsage, err := cpuPercent(1*time.Second, false)
	if err == nil && len(cpuUsage) > 0 {
		info.CPUUsage = cpuUsage[0]
	}

	// Memory usage
	vmStat, err := virtualMemory()
	if err == nil {
		info.MemoryUsage = vmStat.UsedPercent
	}

	// Disk usage (root partition)
	diskStat, err := diskUsage("/")
	if err == nil {
		info.DiskUsage = diskStat.UsedPercent
	}

	// Uptime
	uptime, err := hostUptime()
	if err == nil {
		info.Uptime = uptime
	}

	return info, nil
}
