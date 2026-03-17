# SeedDrop v2

Community engagement assistant for OpenClaw. Monitors Reddit, X/Twitter, Xiaohongshu for relevant discussions and generates value-first replies.

## Quick Start

```bash
clawhub install seeddrop
seeddrop setup
seeddrop auth add reddit
seeddrop monitor reddit
```

## Tech Stack

- **Runtime**: Node.js 24+ / Bun via `npx tsx`
- **Language**: TypeScript (strict mode, ESM)
- **Dependencies**: tsx, typescript (dev only)
- **Platform**: Cross-platform (Windows, Linux, macOS)

## Features

- Multi-platform monitoring (Reddit API, X browser+API, Xiaohongshu browser)
- 4-dimension scoring: relevance, intent, freshness, risk
- Approve and Auto reply modes with safety-first limits
- Optional SocialVault integration for encrypted credentials
- Extensible platform adapter architecture

## Scripts

| Script | Purpose |
|--------|---------|
| `npx tsx scripts/auth-bridge.ts` | Credential management |
| `npx tsx scripts/monitor.ts` | Platform monitoring |
| `npx tsx scripts/scorer.ts` | Post scoring engine |
| `npx tsx scripts/responder.ts` | Reply generation |
| `npx tsx scripts/analytics.ts` | Statistics & reports |

## Pipeline

```
auth-bridge → monitor → scorer → responder → interaction-log
```

See `guides/quickstart.md` for details.
