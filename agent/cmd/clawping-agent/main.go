package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/locuno/clawping/agent/internal/config"
	"github.com/locuno/clawping/agent/internal/heartbeat"
)

type heartbeatStarter interface {
	Start(context.Context) error
}

var (
	loadConfig          = config.Load
	newHeartbeatManager = func(cfg *config.Config) (heartbeatStarter, error) {
		return heartbeat.NewHeartbeatManager(cfg)
	}
	notifyContext = signal.NotifyContext
	exitProcess   = os.Exit
)

func main() {
	exitProcess(run(os.Args[1:]))
}

func run(args []string) int {
	flags := flag.NewFlagSet("clawping-agent", flag.ContinueOnError)
	configPath := flags.String("config", "agent.yaml", "path to agent YAML configuration")
	if err := flags.Parse(args); err != nil {
		log.Printf("failed to parse flags: %v", err)
		return 2
	}

	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Printf("failed to load config: %v", err)
		return 1
	}

	mgr, err := newHeartbeatManager(cfg)
	if err != nil {
		log.Printf("failed to create heartbeat manager: %v", err)
		return 1
	}

	ctx, cancel := notifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	if err := mgr.Start(ctx); err != nil && err != context.Canceled {
		log.Printf("agent stopped with error: %v", err)
		return 1
	}

	return 0
}
