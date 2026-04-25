/**
 * lib/dream/types.ts
 *
 * Type definitions for Dream Consolidation feature
 * Extracted insights, distilled entries, configuration
 */

/**
 * Extracted insight from messages, LSP, or patterns
 * Raw data before distillation
 */
export interface Insight {
  /** Unique ID for this insight */
  id: string;
  
  /** Raw extracted content */
  content: string;
  
  /** Category of insight */
  category: InsightCategory;
  
  /** Salience score 0-100 (higher = more important) */
  severity: number;
  
  /** Source: message ID, tool output ID, or LSP file:line */
  source: string;
  
  /** Programming language if code-related */
  language?: string;
  
  /** If this is a retry pattern, count of occurrences */
  retryCount?: number;
  
  /** Affected file paths */
  affectedFiles?: string[];
  
  /** Timestamp when extracted */
  timestamp: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Insight category
 */
export type InsightCategory =
  | 'security'      // Security vulnerabilities, exploits
  | 'architecture'  // Architecture decisions, patterns
  | 'bug'           // Bugs, errors, failures
  | 'performance'   // Performance optimizations
  | 'dependency'    // Dependency issues, incompatibilities
  | 'error'         // Error patterns, diagnostics
  | 'refactor'      // Refactoring patterns
  | 'other';        // Miscellaneous

/**
 * Distilled entry for AGENTS.md
 * Formatted with symbol notation, deduplicated
 */
export interface DistilledEntry {
  /** Unique ID (may be merged with existing) */
  id: string;
  
  /** Content with symbol notation applied */
  content: string;
  
  /** Category */
  category: InsightCategory;
  
  /** Salience score */
  severity: number;
  
  /** Whether this is newly created (vs merged) */
  isNew: boolean;
  
  /** Whether this entry was updated from an existing one */
  updated?: boolean;
  
  /** Previous version if merged */
  mergedWith?: string;
  
  /** Mark as outdated when superseded */
  outdated?: boolean;
  
  /** When marked as outdated */
  outDatedReason?: string;
  
  /** Timestamp created */
  timestamp: string;
  
  /** Last updated timestamp */
  updatedAt?: string;
  
  /** Session ID where created/updated */
  sessionId: string;
}

/**
 * Result of writing to AGENTS.md
 */
export interface WriteResult {
  /** Number of entries added */
  entriesAdded: number;
  
  /** Number of entries merged with existing */
  mergedEntries: number;
  
  /** Number of entries archived */
  archivedEntries: number;
  
  /** Estimated tokens in new entries */
  tokensEstimated: number;
  
  /** Path to AGENTS.md that was written */
  agentsPath: string;
  
  /** Path to archive if created */
  archivePath?: string;
}

/**
 * Metrics from a dream consolidation run
 */
export interface DreamMetrics {
  /** Total duration in ms */
  durationMs: number;
  
  /** Number of insights extracted */
  insightsExtracted: number;
  
  /** Number of insights distilled */
  insightsDistilled: number;
  
  /** Number of new entries added */
  entriesAdded: number;
  
  /** Number of entries merged */
  entriesMerged: number;
  
  /** Number of entries archived */
  entriesArchived: number;
  
  /** Estimated tokens saved */
  tokensSaved: number;
  
  /** Number of LSP queries executed */
  lspQueriesRun: number;
  
  /** Number of LSP errors */
  lspErrors: number;
  
  /** Session ID */
  sessionId: string;
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Result of dream consolidation run
 */
export interface DreamConsolidationResult {
  /** Metrics from the run */
  metrics: DreamMetrics;
  
  /** Extracted insights */
  insights: Insight[];
  
  /** Distilled entries */
  entries: DistilledEntry[];
  
  /** Write result to AGENTS.md */
  writeResult: WriteResult;
  
  /** Summary for injection into context */
  contextSummary: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

/**
 * LSP analysis result
 */
export interface LSPAnalysisResult {
  /** Extracted function/class signatures */
  symbols: LSPSymbol[];
  
  /** Diagnostics (errors, warnings) */
  diagnostics: LSPDiagnostic[];
  
  /** References to symbols */
  references?: LSPReference[];
  
  /** Queries attempted */
  queriesRun: number;
  
  /** Errors during queries */
  errors: LSPError[];
}

/**
 * LSP symbol (function, class, etc.)
 */
export interface LSPSymbol {
  /** Symbol name */
  name: string;
  
  /** Symbol kind (function, class, interface, etc.) */
  kind: string;
  
  /** Full signature if applicable */
  signature?: string;
  
  /** File path */
  file: string;
  
  /** Line number */
  line: number;
  
  /** Language */
  language: string;
}

/**
 * LSP diagnostic (error, warning, info)
 */
export interface LSPDiagnostic {
  /** Diagnostic message */
  message: string;
  
  /** Severity: 'error' | 'warning' | 'info' */
  severity: 'error' | 'warning' | 'info';
  
  /** File path */
  file: string;
  
  /** Line number */
  line: number;
  
  /** Column */
  column?: number;
  
  /** Language */
  language: string;
  
  /** Error code if applicable */
  code?: string;
}

/**
 * LSP reference
 */
export interface LSPReference {
  /** File path where referenced */
  file: string;
  
  /** Line number */
  line: number;
  
  /** Column */
  column?: number;
  
  /** Reference context */
  context?: string;
}

/**
 * LSP error
 */
export interface LSPError {
  /** Error message */
  message: string;
  
  /** Query type that failed */
  queryType: 'documentSymbol' | 'diagnostics' | 'references' | 'hover' | 'other';
  
  /** Error code if applicable */
  code?: string;
}

/**
 * Retry pattern detected
 */
export interface RetryPattern {
  /** Description of the pattern */
  description: string;
  
  /** Number of occurrences */
  count: number;
  
  /** Message IDs where it occurred */
  messageIds: string[];
  
  /** Error key for normalization */
  errorKey: string;
}

/**
 * Architecture decision detected
 */
export interface ArchDecision {
  /** Decision rationale */
  rationale: string;
  
  /** Message ID where mentioned */
  messageId: string;
  
  /** Confidence 0-1 */
  confidence: number;
}

/**
 * Dream consolidation state
 */
export interface DreamState {
  /** Last dream run timestamp */
  lastDreamRun?: number;
  
  /** Number of entries in backlog */
  dreamEntryCount: number;
  
  /** Whether a dream run is pending */
  pendingDreamRun: boolean;
  
  /** Metrics from most recent run */
  dreamMetrics?: DreamMetrics;
  
  /** When dream was last triggered */
  lastDreamTrigger?: number;
  
  /** Session ID */
  sessionId: string;
}

/**
 * Dream consolidation configuration
 */
export interface DreamConfig {
  /** Enable dream consolidation */
  enabled: boolean;
  
  /** Triggers: when to run dream */
  triggerOn: ('compress' | 'manual' | 'idle')[];
  
  /** Idle timeout in ms before auto-dream */
  idleTimeout: number;
  
  /** Max tokens per distilled entry */
  maxTokensPerEntry: number;
  
  /** Max insights to extract per run */
  maxEntriesPerRun: number;
  
  /** Archive threshold (entries before archiving) */
  archiveThreshold: number;
  
  /** Inject dream summary into agent context */
  injectIntoContext: boolean;
  
  /** Use LSP for code-aware extraction */
  lspEnabled: boolean;
}

/**
 * Symbol notation legend
 */
export const SYMBOL_NOTATION = {
  transforms: '→',      // Evolves, transforms
  replaces: '➔',        // Replaces, migrates
  failed: '❌',         // Failed, error, incompatible
  warning: '⚠️',        // Warning, caution, edge case
  success: '✅',        // Success, fixed, resolved
} as const;

/**
 * Insight salience score components
 */
export interface SalienceScore {
  /** Keyword-based score 0-100 */
  keywordScore: number;
  
  /** Retry count-based score 0-50 */
  retryScore: number;
  
  /** Impact scope score 0-30 */
  impactScore: number;
  
  /** Recency-based score 0-20 */
  recencyScore: number;
  
  /** Total weighted score 0-100 */
  totalScore: number;
}

/**
 * Keyword weights for salience scoring
 */
export const KEYWORD_WEIGHTS = {
  security: 95,
  vulnerability: 95,
  exploit: 90,
  fix: 50,
  bug: 60,
  error: 40,
  performance: 60,
  refactor: 50,
  architecture: 70,
  pattern: 55,
  dependency: 50,
  crash: 80,
  fail: 70,
  panic: 85,
} as const;

/**
 * Parsed AGENTS.md backlog entry
 */
export interface BacklogEntry {
  /** Entry ID (auto-generated or from timestamp) */
  id: string;
  
  /** Full entry text */
  content: string;
  
  /** Category detected */
  category: InsightCategory;
  
  /** Whether marked as outdated */
  outdated: boolean;
  
  /** Timestamp if present */
  timestamp?: string;
  
  /** Session ID if present */
  sessionId?: string;
}
