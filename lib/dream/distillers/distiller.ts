/**
 * lib/dream/distillers/distiller.ts
 *
 * Phase 2.3: Distillation Engine
 * Applies symbol notation, deduplicates, merges with existing AGENTS.md
 */

import type { Insight, DistilledEntry, DreamConfig } from "../types"
import { SYMBOL_NOTATION } from "../types"
import { logger } from "../../logger"

/**
 * Main distillation function
 * Transforms raw insights into formatted entries
 */
export async function distillInsights(
    insights: Insight[],
    existingAgentsContent: string,
    sessionId: string,
    config: DreamConfig,
): Promise<DistilledEntry[]> {
    logger.info(`[Dream] Distilling ${insights.length} insights`)

    const entries: DistilledEntry[] = []

    // 1. Parse existing entries from AGENTS.md
    const existingEntries = parseExistingEntries(existingAgentsContent)
    logger.debug(`[Dream] Found ${existingEntries.length} existing entries`)

    // 2. For each insight, either create new or merge with existing
    for (const insight of insights) {
        const existingMatch = findExistingMatch(insight, existingEntries)

        if (existingMatch) {
            // Merge with existing
            const merged = mergeInsightWithExisting(insight, existingMatch, sessionId)
            entries.push(merged)
        } else {
            // Create new entry
            const newEntry: DistilledEntry = {
                id: insight.id,
                content: applySymbolNotation(insight),
                category: insight.category,
                severity: insight.severity,
                isNew: true,
                timestamp: new Date().toISOString(),
                sessionId,
            }
            entries.push(newEntry)
        }
    }

    // 3. Deduplicate similar entries
    const deduplicated = deduplicateEntries(entries)

    logger.info(
        `[Dream] Distilled to ${deduplicated.length} entries (${entries.length - deduplicated.length} duplicates removed)`,
    )
    return deduplicated
}

/**
 * Apply symbol notation to insight
 * Transform raw insight into symbolic format
 */
function applySymbolNotation(insight: Insight): string {
    const { category, content, severity, retryCount } = insight

    // Handle null/undefined content
    if (!content || typeof content !== "string") {
        return `[Empty content] ${SYMBOL_NOTATION.warning}`
    }

    // Extract key components from content
    const firstSentence = content.split(".")[0] || content

    switch (category) {
        case "security": {
            // Format: "Issue: Old approach → New approach ✅"
            return `${extractKeyTerm(firstSentence)}: ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
        }

        case "architecture": {
            // Format: "Component: Old pattern → New pattern ✅"
            return `${extractComponent(firstSentence)}: ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
        }

        case "bug": {
            if (retryCount && retryCount >= 2) {
                // Format: "Error (Nx): Problem → Solution ✅"
                return `${extractKeyTerm(firstSentence)} (${retryCount}x): ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
            }
            // Format: "Bug: Issue → Fix ✅"
            return `${extractKeyTerm(firstSentence)}: ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
        }

        case "performance": {
            // Format: "Optimization: Problem → Solution ✅"
            return `${extractComponent(firstSentence)}: ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
        }

        case "dependency": {
            // Format: "Library Issue: Problem ⚠️"
            return `${extractDependency(firstSentence)}: ${extractIssue(firstSentence)} ${SYMBOL_NOTATION.warning}`
        }

        case "error": {
            // Format: "Error Type: Description ⚠️"
            return `${extractKeyTerm(firstSentence)}: ${firstSentence.substring(20, 80)} ${SYMBOL_NOTATION.warning}`
        }

        case "refactor": {
            // Format: "Code Area: Old → New ✅"
            return `${extractComponent(firstSentence)}: ${extractOldNew(firstSentence)} ${SYMBOL_NOTATION.success}`
        }

        default: {
            // Fallback
            return `${firstSentence.substring(0, 80)} ${SYMBOL_NOTATION.warning}`
        }
    }
}

/**
 * Extract key term from content
 */
function extractKeyTerm(content: string): string {
    // First capitalized word or noun
    const words = content.split(/\s+/)
    for (const word of words) {
        if (/^[A-Z]/.test(word) && word.length > 2) {
            return word.replace(/[,:.]$/, "")
        }
    }
    return content.substring(0, 20)
}

/**
 * Extract component/area name
 */
function extractComponent(content: string): string {
    // Look for "X module", "X system", "X pattern"
    const match = content.match(/(\w+)\s+(?:module|system|pattern|layer|component)/i)
    if (match) {
        return match[1]
    }
    return extractKeyTerm(content)
}

/**
 * Extract dependency/library name
 */
function extractDependency(content: string): string {
    // Look for library names (capitalized or in backticks)
    const match = content.match(/`([^`]+)`|([A-Z]\w+)(?:\s+library|\s+package)/)
    if (match) {
        return match[1] || match[2]
    }
    return extractKeyTerm(content)
}

/**
 * Extract issue description
 */
function extractIssue(content: string): string {
    return content.substring(0, 60)
}

/**
 * Extract old and new in format "old → new"
 */
function extractOldNew(content: string): string {
    // Look for "from X to Y" or "X to Y" pattern
    const patterns = [/from\s+(.+?)\s+to\s+(.+?)(?:\.|,|$)/i, /(\w+)\s+(?:to|→)\s+(\w+)/i]

    for (const pattern of patterns) {
        const match = content.match(pattern)
        if (match) {
            return `${match[1]} ${SYMBOL_NOTATION.transforms} ${match[2]}`
        }
    }

    // Fallback
    return `${content.substring(0, 40)} ${SYMBOL_NOTATION.replaces} ${content.substring(40, 80)}`
}

/**
 * Parse existing entries from AGENTS.md
 */
function parseExistingEntries(content: string): DistilledEntry[] {
    const entries: DistilledEntry[] = []

    // Extract lines that look like entries
    const lines = content.split("\n")
    for (const line of lines) {
        if (!line.startsWith("* **")) continue

        // Parse category and content
        const match = line.match(/\* \*\*(\w+)\*\*: (.+)$/)
        if (!match) continue

        const [, categoryStr, contentStr] = match
        const category = categoryStr.toLowerCase() as any

        entries.push({
            id: `existing_${entries.length}`,
            content: contentStr,
            category,
            severity: 50, // Default for existing entries
            isNew: false,
            timestamp: "",
            sessionId: "existing",
        })
    }

    return entries
}

/**
 * Find existing entry matching insight
 */
function findExistingMatch(insight: Insight, existing: DistilledEntry[]): DistilledEntry | null {
    // Extract keywords from insight
    const keywords = extractKeywords(insight.content)
    if (keywords.length === 0) return null

    // Look for match by category + keyword
    for (const entry of existing) {
        if (entry.category !== insight.category) continue

        for (const keyword of keywords) {
            if (entry.content.toLowerCase().includes(keyword.toLowerCase())) {
                return entry
            }
        }
    }

    return null
}

/**
 * Extract keywords from content
 */
function extractKeywords(content: string | null | undefined): string[] {
    // Handle null/undefined content
    if (!content || typeof content !== "string") {
        return []
    }
    // Split on whitespace and punctuation, filter short words
    return content.split(/[\s,:;.]+/).filter((w) => w.length > 3)
}

/**
 * Merge insight with existing entry
 */
function mergeInsightWithExisting(
    insight: Insight,
    existing: DistilledEntry,
    sessionId: string,
): DistilledEntry {
    // If new insight is higher severity, use it as primary
    if (insight.severity > existing.severity) {
        return {
            ...existing,
            content: `${existing.content} (Outdated - see new: ${applySymbolNotation(insight)})`,
            severity: insight.severity,
            updated: true,
            mergedWith: existing.content,
            updatedAt: new Date().toISOString(),
            sessionId,
        }
    }

    // Otherwise keep existing
    return existing
}

/**
 * Deduplicate similar entries
 */
function deduplicateEntries(entries: DistilledEntry[]): DistilledEntry[] {
    const seen = new Map<string, DistilledEntry>()

    // Sort by severity to keep high-signal entries
    const sorted = [...entries].sort((a, b) => b.severity - a.severity)

    for (const entry of sorted) {
        // Normalize content for comparison
        const normalized = normalizeForComparison(entry.content)

        if (!seen.has(normalized)) {
            seen.set(normalized, entry)
        }
    }

    return Array.from(seen.values())
}

/**
 * Normalize content for dedup comparison
 */
function normalizeForComparison(content: string): string {
    return content
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .substring(0, 50)
}

/**
 * Export utils for testing
 */
export const DistillerUtils = {
    applySymbolNotation,
    parseExistingEntries,
    extractKeywords,
    normalizeForComparison,
}
