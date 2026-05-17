# ClawPing Root Skill

Use this repo with a verify-first mindset.

## Fast Start

1. Read [AGENTS.md](/Volumes/SSD/clawping/clawping/AGENTS.md).
2. Read [product-spec.md](/Volumes/SSD/clawping/clawping/product-spec.md).
3. Use [product-spec-checklist.md](/Volumes/SSD/clawping/clawping/product-spec-checklist.md) to confirm scope.

## Core Commands

```bash
pnpm test
pnpm coverage
pnpm lint
pnpm typecheck
pnpm build
```

```bash
pnpm --filter @clawping/worker dev
pnpm --filter @clawping/dashboard dev
```

## Verification Bar

- TypeScript coverage: 100%
- Go coverage: 100%
- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm build`: pass
