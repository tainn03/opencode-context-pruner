# Dream Consolidation: User Guide

## Overview

**Dream Consolidation** is an offline consolidation engine that extracts insights from your conversation history and builds a persistent, searchable institutional memory. It helps agents remember past decisions, patterns, and lessons across sessions.

The feature is **opt-in** and **disabled by default** — it never blocks your work or interferes with compression.

## What It Does

Dream Consolidation runs a 4-phase pipeline to consolidate your session insights:

1. **Extract** - Scan recent messages for salient insights (bugs, decisions, errors, security issues)
2. **Distill** - Apply symbolic notation and deduplicate insights into concise entries
3. **Write** - Persist entries to `~/.opencode/AGENTS-archive.md` with non-destructive archiving
4. **Inject** - Inject the most recent insights into agent system prompts for memory

Result: A searchable knowledge base that remembers your project's lessons.

## Enabling Dream Consolidation

### 1. Update Your Config

Edit `.opencode/dcp.jsonc` (or global `~/.config/opencode/dcp.jsonc`):

```jsonc
{
  "dream": {
    "enabled": true,                    // Enable the feature
    "triggerOn": ["compress", "idle"],  // When to run (compress = after compression, idle = on inactivity)
    "idleTimeout": 300,                 // Idle timeout in seconds (default: 5 min)
    "archiveThreshold": 50,             // Auto-archive when entries exceed this (default: 50)
    "maxEntriesPerRun": 15,             // Max new entries per run (default: 15)
    "injectIntoContext": true,          // Inject memory into agent prompts (default: true)
    "lspEnabled": false                 // Use LSP for code-aware extraction (default: false, expert)
  }
}
```

### 2. Restart OpenCode

```bash
opencode
```

Dream Consolidation will start on your next session. You'll see `~/.opencode/AGENTS-archive.md` created automatically.

## Using Dream Commands

### `/dream stats` - View Session Memory

Shows memory status and metrics:

```
╭─ Dream Memory Stats ─────────────────────────────╮
│ Active Entries..............................45    │
│ Archived Entries...........................150    │
│ Categories..................................8    │
│                                                  │
│ Category Breakdown:                              │
│ • security......... 12 ✅✅✅✅✅✅✅✅✅✅✅✅ │
│ • architecture...... 8 ✅✅✅✅✅✅✅✅         │
│ • bug............ 18 ✅✅✅✅✅✅✅✅✅✅✅✅  │
│ • performance...... 3 ✅✅✅                     │
│ • dependency....... 2 ✅✅                      │
│ • error............ 1 ✅                        │
│ • refactor........ 1 ✅                        │
│ • other........... 0                            │
╰──────────────────────────────────────────────────╯
```

### `/dream run` - Manually Trigger Consolidation

Force an immediate consolidation run:

```
╭─ Dream Consolidation Result ──────────────────────╮
│ Extracted Insights...........................12   │
│ Distilled Entries.............................9   │
│ Written to AGENTS.md...........................9   │
│ Injected into Context....................... ✅   │
│ Session ID........ ses_abc123def456ghi789jkl0   │
│ File............. ~/.opencode/AGENTS-archive.md            │
╰───────────────────────────────────────────────────╯
```

### `/dream preview` - Preview Pending Entries

See what insights are pending before they're written:

```
Pending Insights (9 entries):
  1. [security] Database connection hardening ✅ (ses_abc123)
  2. [bug] Memory leak in cache cleanup (3x) ✅ (ses_abc123)
  3. [architecture] Migrate from monolith → microservices ✅ (ses_abc123)
  ...
```

### `/dream archive [n]` - Archive Specific Entries

Archive the N oldest entries to `~/.opencode/AGENTS-archive.md`:

```
Archived 15 entries to AGENTS-archive.md
Kept 35 most recent in AGENTS.md
Total memory: 50 entries
```

### `/dream help` - Show Command Reference

```
Dream Consolidation Commands:

  /dream stats          View memory status and metrics
  /dream run            Manually trigger consolidation
  /dream preview        Preview pending entries
  /dream archive [n]    Archive N oldest entries
  /dream help           Show this help
```

## Understanding Your Memory

### `~/.opencode/AGENTS-archive.md` Format

Your institutional memory is stored in human-readable Markdown:

```markdown
# AGENTS.md — Session Memory

## Security (12 entries)

* **security**: Database connection hardening: plain-text → TLS/mTLS ✅ *(ses_abc123)*
* **security**: API key rotation: manual → automated quarterly ✅ *(ses_abc123)*

## Bugs (18 entries)

* **bug**: Memory leak in cache cleanup (3x): untracked refs → explicit cleanup ✅ *(ses_def456)*
* **bug**: Race condition in async loop: unchecked → mutex-protected ✅ *(ses_ghi789)*

## Architecture (8 entries)

* **architecture**: Cache layer: embedded Redis → external cluster ✅ *(ses_jkl012)*

...
```

### Symbol Notation

- `✅` Success, resolved, or best practice
- `→` Evolution or transformation (old → new)
- `⚠️` Warning or known issue
- `❌` Failed or deprecated approach
- `(Outdated)` Previously recorded, now superseded
- `(Deprecated)` No longer recommended

### Categories

| Category | Usage | Example |
|----------|-------|---------|
| **security** | Vulnerabilities, hardening, auth | "SQL injection → parameterized queries ✅" |
| **architecture** | Design decisions, refactors | "Monolith → microservices ✅" |
| **bug** | Defects found and fixed | "Memory leak (2x) → explicit cleanup ✅" |
| **performance** | Optimizations, bottlenecks | "O(n²) sort → O(n log n) ✅" |
| **dependency** | Package upgrades, removals | "Lodash → native array methods ✅" |
| **error** | Runtime errors, crashes | "Connection timeout ⚠️" |
| **refactor** | Code cleanup, structure | "Callback hell → async/await ✅" |
| **other** | Miscellaneous insights | General notes |

## Keyword Scoring

Dream detects insights based on keyword salience:

| Keyword | Weight | Triggers On |
|---------|--------|-------------|
| security | 95 | "vulnerability", "exploit", "breach" |
| vulnerability | 95 | SQL injection, XSS, CSRF |
| exploit | 90 | Security attack patterns |
| crash | 80 | Application crashes, panics |
| fix | 70 | Bug fixes, patches |
| migration | 60 | Migrations, version upgrades |
| bug | 60 | Defects, regressions |
| performance | 60 | Optimizations, bottlenecks |
| architecture | 70 | Design patterns, structure |
| refactor | 50 | Code cleanup, modernization |
| error | 40 | Error messages, exceptions |
| dependency | 35 | Package management, versions |
| optimization | 40 | Speed, memory, efficiency |
| other | 20 | General insights |

## Retry Pattern Detection

Dream automatically detects repeated errors and learns from them:

```
Session A:
  User: "Error: Connection timeout"
  Assistant: "Retrying..."
  User: "Error: Connection timeout"
  Assistant: "Retrying..."
  User: "Error: Connection timeout"

→ Insight: "Connection timeout (3x): retry logic → backoff with exponential delay ✅"
```

## FAQ

### Q: Does Dream Consolidation slow down my sessions?

**A**: No. Dream runs asynchronously in the background after compression or during idle time. It never blocks your work.

### Q: Can I delete the memory?

**A**: Yes. Delete `~/.opencode/AGENTS-archive.md` to reset. Archive entries remain in `~/.opencode/AGENTS-archive.md` if you want to preserve history.

### Q: How much context does injected memory use?

**A**: The 7 most recent entries (~100 tokens) are injected into agent system prompts. You can disable injection with `injectIntoContext: false` in config.

### Q: Can I use this with subagents?

**A**: By default, subagents skip Dream Consolidation to avoid context explosion. Enable with `experimental.allowSubAgents: true` in config if needed.

### Q: Does Dream share memory across sessions?

**A**: Yes! AGENTS.md is shared across all sessions in the project. Each entry includes the sessionId it came from for traceability.

### Q: What if I have conflicting entries?

**A**: Dream keeps the highest-severity entry and marks older ones with `(Outdated)`. This preserves history while prioritizing recent learnings.

### Q: Can I manually edit AGENTS.md?

**A**: Yes! AGENTS.md is plain Markdown. You can add, remove, or edit entries directly. Dream will merge them with future consolidations.

## Rollout Strategy

### Phase 1: Pilot (Single Project)

1. Enable Dream in `.opencode/dcp.jsonc` with `triggerOn: ["compress"]`
2. Run several sessions, monitor `/dream stats`
3. Review `~/.opencode/AGENTS-archive.md` for quality
4. Adjust keyword weights or categories as needed

### Phase 2: Production (All Projects)

1. Enable globally in `~/.config/opencode/dcp.jsonc`
2. Set `triggerOn: ["compress", "idle"]` for continuous updates
3. Monitor archive growth — adjust `archiveThreshold` if needed
4. Share best practices with team

### Phase 3: Advanced (LSP Integration)

1. Enable `lspEnabled: true` to use LSP for code-aware extraction
2. Dream will analyze AST patterns, type changes, function signatures
3. Provides higher-quality architectural insights
4. Trade-off: ~20% slower but more accurate

## Troubleshooting

### Dream isn't triggering

**Check**:
- `dream.enabled: true` in config
- Session has messages to analyze
- Compression triggers or idle timeout met
- Restart OpenCode

### Memory entries seem low-quality

**Adjust**:
- Lower keyword weights for noisy terms
- Increase `archiveThreshold` to keep more history
- Review extraction logic in `lib/dream/extractors/messages.ts`
- Enable `debug: true` in config for verbose logging

### AGENTS.md is growing too fast

**Options**:
- Decrease `maxEntriesPerRun` (fewer entries per consolidation)
- Increase `archiveThreshold` (archive more aggressively)
- Run `/dream archive 20` to manually archive older entries

### Injected memory isn't helping agents

**Try**:
- Increase `maxEntriesPerRun` to include more entries
- Manually edit AGENTS.md to highlight key insights
- Enable `lspEnabled: true` for code-aware extraction
- Review `/dream stats` to verify entries are being injected

## Technical Details

### Token Counting

- Injected memory limited to ~100 tokens (7 most recent entries)
- Prevents context bloat while preserving recent learnings
- Older entries archived to `~/.opencode/AGENTS-archive.md` (not injected)

### Non-Destructive Archiving

- Never erases entries, always marks with `(Outdated)` or `(Deprecated)`
- Archive entries preserved in `~/.opencode/AGENTS-archive.md` for reference
- Allows future agents to review full history if needed

### Rate Limiting

- Max 1 consolidation run per 5 minutes
- Prevents excessive processing
- Respects `idleTimeout` configuration

### Multi-Language Support

Dream works with code in any language by detecting file types:
- TypeScript, JavaScript, Python, Java, Go, Rust, C++, etc.
- Extracts language-specific patterns and conventions

## Best Practices

1. **Review regularly**: Check `/dream stats` weekly to verify quality
2. **Archive strategically**: Archive at `archiveThreshold` to keep recent memory fresh
3. **Collaborate**: Share AGENTS.md with your team for collective learning
4. **Customize keywords**: Adjust weights for your project's priorities
5. **Document decisions**: Use Dream to record architectural decisions for future reference
6. **Iterate**: Refine keyword scoring based on what works for your codebase

## Support

For issues or feature requests, see the [Dream Consolidation Architecture](../lib/dream/ARCHITECTURE.md) or file an issue on GitHub.

---

**Version**: 1.0.0  
**Status**: Production-ready  
**License**: AGPL-3.0-or-later
