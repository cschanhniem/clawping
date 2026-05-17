# Shared Package

## Overview

This package contains shared types, schema validation, session signing, and token hashing used by both the worker and the dashboard.

## Key Components

- Public export barrel: [src/index.ts](/Volumes/SSD/clawping/clawping/packages/shared/src/index.ts)
- Shared types: [src/types.ts](/Volumes/SSD/clawping/clawping/packages/shared/src/types.ts)
- Schema validation helpers: [src/schema.ts](/Volumes/SSD/clawping/clawping/packages/shared/src/schema.ts)
- Crypto helpers: [src/crypto.ts](/Volumes/SSD/clawping/clawping/packages/shared/src/crypto.ts)

## Diagrams

### Flowchart

```mermaid
flowchart TD
  A["worker"] --> B["shared schema + crypto"]
  C["dashboard"] --> B
  D["tests"] --> B
```

### Component Diagram

```mermaid
flowchart LR
  IDX["index.ts"] --> T["types.ts"]
  IDX --> S["schema.ts"]
  IDX --> C["crypto.ts"]
```

### Sequence Diagram

```mermaid
sequenceDiagram
  participant Worker
  participant Shared
  participant Dashboard

  Worker->>Shared: parse heartbeat / sign session / hash token
  Dashboard->>Shared: decode shared response shapes
```
