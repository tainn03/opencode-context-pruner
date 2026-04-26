/**
 * lib/dream/extractors/messages.ts
 *
 * Phase 1: Extract insights from recent messages
 * Scans last 20-30 messages for salient content
 * Detects: keywords, errors, patterns, retry attempts
 */

// Generic context type for plugin context
type PluginContext = any
import type { Insight, DreamConfig, SalienceScore, RetryPattern, ArchDecision } from "../types"
import { KEYWORD_WEIGHTS, SYMBOL_NOTATION } from "../types"
import { logger } from "../../logger"

/**
 * Extract insights from recent messages
 * Main entry point for Phase 1
 */
export async function extractInsightsFromMessages(
    messages:
        | Array<{ id?: string; role: string; content?: string; toolUse?: unknown[] }>
        | null
        | undefined,
    context: PluginContext,
    config: DreamConfig,
    focus?: string,
): Promise<Insight[]> {
    const insights: Insight[] = []

    // Handle null/undefined messages
    if (!messages || !Array.isArray(messages)) {
        logger.debug(`[Dream] No messages to scan`)
        return insights
    }

    // 1. Extract from recent messages (last 20-30)
    const recentMessages = messages.slice(-30)
    logger.debug(`[Dream] Scanning ${recentMessages.length} recent messages`)

    // 2. Extract keyword-based insights
    const keywordInsights = extractKeywordInsights(recentMessages)
    insights.push(...keywordInsights)

    // 3. Detect retry patterns (same error 2+ times)
    const retryPatterns = detectRetryPatterns(recentMessages)
    insights.push(...retryPatterns)

    // 4. Detect architecture decisions
    const archDecisions = detectArchitectureDecisions(recentMessages)
    insights.push(...archDecisions)

    // 5. Extract error patterns from LSP (if enabled)
    if (config.lspEnabled) {
        const lspErrors = await extractLSPErrors(context, config)
        insights.push(...lspErrors)
    }

    // 6. Filter by focus if specified
    let filtered = insights
    if (focus) {
        filtered = insights.filter(
            (i) => i.category === focus || i.content.toLowerCase().includes(focus.toLowerCase()),
        )
        logger.debug(`[Dream] Filtered to ${filtered.length} insights for focus="${focus}"`)
    }

    // 7. Sort by salience score
    filtered.sort((a, b) => b.severity - a.severity)

    // 8. Assign unique IDs
    let idCounter = 0
    for (const insight of filtered) {
        if (!insight.id) {
            insight.id = `insight_${Date.now()}_${idCounter++}`
        }
    }

    logger.info(`[Dream] Extracted ${filtered.length} insights from messages`)
    return filtered
}

/**
 * Extract keyword-based insights
 * Scans for high-impact keywords in message content
 */
function extractKeywordInsights(messages: unknown[]): Insight[] {
    const insights: Insight[] = []

    for (const msg of messages) {
        if (typeof msg !== "object" || !msg) continue
        const m = msg as Record<string, unknown>

        // Get content
        let content = ""
        if (typeof m.content === "string") {
            content = m.content
        }

        if (!content) continue

        // Score keywords
        const score = scoreKeywords(content)
        if (score <= 0) continue

        // Determine category
        const category = detectCategory(content)

        insights.push({
            id: `kwi_${Date.now()}_${Math.random()}`,
            content: content.substring(0, 200),
            category,
            severity: score,
            source: m.id ? String(m.id) : "unknown",
            language: detectLanguage(content),
            timestamp: new Date().toISOString(),
        })
    }

    return insights
}

/**
 * Score keywords in content
 * Returns 0-100 based on presence of salient keywords
 */
function scoreKeywords(content: string): number {
    const lower = content.toLowerCase()
    let score = 0

    // Check each keyword
    for (const [keyword, weight] of Object.entries(KEYWORD_WEIGHTS)) {
        if (lower.includes(keyword)) {
            score = Math.max(score, weight)
        }
    }

    // Boost if multiple keywords
    let keywordCount = 0
    for (const keyword of Object.keys(KEYWORD_WEIGHTS)) {
        if (lower.includes(keyword)) keywordCount++
    }
    if (keywordCount >= 2) {
        score = Math.min(100, score + 15)
    }

    return score
}

/**
 * Detect category from content
 */
function detectCategory(
    content: string,
):
    | "security"
    | "architecture"
    | "bug"
    | "performance"
    | "dependency"
    | "error"
    | "refactor"
    | "other" {
    const lower = content.toLowerCase()

    if (
        lower.includes("security") ||
        lower.includes("vulnerability") ||
        lower.includes("exploit") ||
        lower.includes("injection")
    ) {
        return "security"
    }
    if (
        lower.includes("architecture") ||
        lower.includes("pattern") ||
        lower.includes("migrat") ||
        lower.includes("design")
    ) {
        return "architecture"
    }
    if (lower.includes("performance") || lower.includes("optimiz") || lower.includes("slow")) {
        return "performance"
    }
    if (
        lower.includes("bug") ||
        lower.includes("fix") ||
        lower.includes("error") ||
        lower.includes("issue")
    ) {
        return "bug"
    }
    if (lower.includes("depend") || lower.includes("library") || lower.includes("package")) {
        return "dependency"
    }
    if (lower.includes("error") || lower.includes("fail") || lower.includes("crash")) {
        return "error"
    }
    if (lower.includes("refactor") || lower.includes("clean") || lower.includes("improve")) {
        return "refactor"
    }

    return "other"
}

/**
 * Detect programming language from content
 */
function detectLanguage(content: string): string {
    const patterns: Array<[RegExp, string]> = [
        [/typescript|\.ts|interface.*{|enum.*{/i, "TypeScript"],
        [/^import|^export|async function|=>|const.*=/i, "TypeScript"],
        [/python|\.py|def |import /i, "Python"],
        [/java|public class|@Override|new ArrayList/i, "Java"],
        [/go|func |package main|fmt\.Println/i, "Go"],
        [/rust|fn |impl |match /i, "Rust"],
        [/c\+\+|\.cpp|std::/i, "C++"],
        [/\.json|{.*}/i, "JSON"],
    ]

    for (const [pattern, lang] of patterns) {
        if (pattern.test(content)) {
            return lang
        }
    }

    return "unknown"
}

/**
 * Detect retry patterns
 * Identifies errors that occur 2+ times
 */
function detectRetryPatterns(messages: unknown[]): Insight[] {
    const errorMap = new Map<string, { count: number; examples: string[]; messageIds: string[] }>()

    // Collect errors
    for (const msg of messages) {
        if (typeof msg !== "object" || !msg) continue
        const m = msg as Record<string, unknown>

        // Look for error-like content
        let content = ""
        if (typeof m.content === "string") {
            content = m.content
        }

        if (!content || !/(error|failed|fail|exception|crash|panic)/i.test(content)) continue

        // Extract error key
        const errorKey = normalizeError(content)
        if (!errorKey) continue

        // Track
        const existing = errorMap.get(errorKey) || { count: 0, examples: [], messageIds: [] }
        existing.count++
        existing.examples.push(content.substring(0, 100))
        if (m.id) existing.messageIds.push(String(m.id))

        errorMap.set(errorKey, existing)
    }

    // Convert to insights (only count >= 2)
    const insights: Insight[] = []
    for (const [errorKey, data] of errorMap.entries()) {
        if (data.count < 2) continue

        const insight: Insight = {
            id: `retry_${Date.now()}_${Math.random()}`,
            content: `Recurring error (${data.count}x): ${errorKey}`,
            category: "bug",
            severity: Math.min(100, 70 + data.count * 5), // Boost for more retries
            source: data.messageIds.join(","),
            retryCount: data.count,
            affectedFiles: extractFilePathsFromExamples(data.examples),
            timestamp: new Date().toISOString(),
        }

        insights.push(insight)
    }

    return insights
}

/**
 * Normalize error for comparison
 * Extract key error pattern
 */
function normalizeError(errorContent: string): string {
    // Extract first line or error message
    const lines = errorContent.split("\n")
    const errorLine = lines.find((l) => /error|fail|exception/i.test(l))

    if (!errorLine) {
        return errorContent.substring(0, 50)
    }

    // Remove specific values (line numbers, timestamps, etc.)
    return errorLine
        .replace(/:\d+/g, ":N") // Line numbers
        .replace(/0x[0-9a-f]+/gi, "0xN") // Memory addresses
        .replace(/\d{10,}/g, "N") // Large numbers
        .substring(0, 100)
}

/**
 * Extract file paths from error examples
 */
function extractFilePathsFromExamples(examples: string[]): string[] {
    const paths = new Set<string>()

    for (const example of examples) {
        const matches = example.match(
            /(?:src|lib|app)\/[a-zA-Z0-9\-_.\/]+(\.ts|\.js|\.py|\.java)/gi,
        )
        if (matches) {
            matches.forEach((p) => paths.add(p))
        }
    }

    return Array.from(paths)
}

/**
 * Detect architecture decisions
 * Look for patterns like "migrated to", "changed to", "refactored to"
 */
function detectArchitectureDecisions(messages: unknown[]): Insight[] {
    const patterns = [
        /migrat\w* from (.+?) to (.+?)(?:\.|,|;|$)/gi,
        /chang\w* (?:to|from) (.+?) (?:to|→|->)? ?(.+?)(?:\.|,|;|$)/gi,
        /refactor\w* to (.+?)(?:\.|,|;|$)/gi,
        /decided to (.+?) because (.+?)(?:\.|,|;|$)/gi,
        /architecture (?:change|decision): (.+?)(?:\.|,|;|$)/gi,
    ]

    const insights: Insight[] = []

    for (const msg of messages) {
        if (typeof msg !== "object" || !msg) continue
        const m = msg as Record<string, unknown>

        let content = ""
        if (typeof m.content === "string") {
            content = m.content
        }

        if (!content) continue

        // Check patterns
        for (const pattern of patterns) {
            const matches = [...content.matchAll(pattern)]
            for (const match of matches) {
                const decision = match[0].substring(0, 150)

                insights.push({
                    id: `arch_${Date.now()}_${Math.random()}`,
                    content: decision,
                    category: "architecture",
                    severity: 80, // Architecture decisions are high-signal
                    source: m.id ? String(m.id) : "unknown",
                    timestamp: new Date().toISOString(),
                })
            }
        }
    }

    return insights
}

/**
 * Extract LSP-based errors
 * Queries LSP for active diagnostics
 */
async function extractLSPErrors(context: PluginContext, config: DreamConfig): Promise<Insight[]> {
    // This would integrate with LSP module in Phase 2.2
    // For now, return empty
    return []
}

/**
 * Export utils for testing
 */
export const ExtractorUtils = {
    scoreKeywords,
    detectCategory,
    detectLanguage,
    normalizeError,
    extractFilePathsFromExamples,
}
