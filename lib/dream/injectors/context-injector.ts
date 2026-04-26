/**
 * lib/dream/injectors/context-injector.ts
 *
 * Phase 3.2: Inject dream summary into agent context
 * Provides long-term memory for subsequent agent turns
 */

// Generic context type
type PluginContext = any

import type { DreamConfig } from "../types"
import { logger } from "../../logger"

/**
 * Extract and inject latest dream entries into context
 * Summary is prepended to system prompt or injected as pseudo-tool
 */
export async function injectDreamContext(
    agentsContent: string,
    context: PluginContext,
    config: DreamConfig,
): Promise<string> {
    if (!config.injectIntoContext || !agentsContent) {
        return ""
    }

    try {
        logger.debug("[Dream] Injecting context: extracting latest entries")

        // 1. Parse AGENTS.md entries
        const entries = parseAgentsMarkdown(agentsContent)
        if (entries.length === 0) {
            logger.debug("[Dream] No entries to inject")
            return ""
        }

        // 2. Take latest N entries (default 7, keep under 100 tokens)
        const latestEntries = entries.slice(Math.max(0, entries.length - 7))

        // 3. Summarize into context string
        const summary = buildContextSummary(latestEntries)

        logger.debug(`[Dream] Injected context summary: ${summary.length} chars`)
        return summary
    } catch (err) {
        logger.warn(
            `[Dream] Context injection failed: ${err instanceof Error ? err.message : String(err)}`,
        )
        return ""
    }
}

/**
 * Parse AGENTS.md and extract entries
 */
function parseAgentsMarkdown(content: string): Array<{
    category: string
    content: string
}> {
    const entries: Array<{ category: string; content: string }> = []

    const lines = content.split("\n")
    for (const line of lines) {
        // Match: * **category**: content
        const match = line.match(/^\* \*\*([^\*]+)\*\*: (.+?)$/)
        if (match) {
            const [, category, entryContent] = match
            entries.push({
                category: category.trim(),
                content: entryContent.trim(),
            })
        }
    }

    return entries
}

/**
 * Build context summary from latest entries
 * Target: < 100 tokens
 */
function buildContextSummary(entries: Array<{ category: string; content: string }>): string {
    if (entries.length === 0) {
        return ""
    }

    // Group by category
    const byCategory = new Map<string, string[]>()
    for (const entry of entries) {
        if (!byCategory.has(entry.category)) {
            byCategory.set(entry.category, [])
        }
        byCategory.get(entry.category)!.push(entry.content)
    }

    // Build summary
    let summary = "[Dream Memory: Recent Technical Backlog]\n"

    for (const [category, contents] of byCategory.entries()) {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1)
        summary += `- ${categoryTitle}: `
        summary += contents.slice(0, 2).join("; ") + "\n" // Take first 2 per category
    }

    // Estimate tokens (rough: 1 token per 4 chars)
    const estimatedTokens = Math.round(summary.length / 4)
    logger.debug(`[Dream] Context summary: ${estimatedTokens} tokens, ${entries.length} entries`)

    return summary
}

/**
 * Format context summary for system prompt injection
 */
export function formatContextForSystemPrompt(contextSummary: string): string {
    if (!contextSummary) {
        return ""
    }

    return (
        "\n\n---\n" +
        contextSummary +
        "\n---\n" +
        "Use this technical memory to avoid repeating past mistakes and reference prior solutions.\n"
    )
}

/**
 * Export utilities for testing
 */
export const InjectorUtils = {
    parseAgentsMarkdown,
    buildContextSummary,
    formatContextForSystemPrompt,
}
