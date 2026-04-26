/**
 * lib/dream/index.ts
 *
 * Main entry point for Dream Consolidation
 * Orchestrates extraction, distillation, application phases
 */

// Generic context type for plugin context
type PluginContext = any
import type {
    DreamConfig,
    DreamConsolidationResult,
    DreamMetrics,
    DreamState,
    Insight,
    DistilledEntry,
} from "./types"
import { logger } from "../logger"

/**
 * Main orchestration function
 * Runs all 4 phases: extract → distill → apply → inject
 */
export async function runDreamConsolidation(
    sessionId: string,
    context: PluginContext,
    config: DreamConfig,
    focus?: string,
): Promise<DreamConsolidationResult> {
    const startTime = Date.now()
    const metrics: DreamMetrics = {
        durationMs: 0,
        insightsExtracted: 0,
        insightsDistilled: 0,
        entriesAdded: 0,
        entriesMerged: 0,
        entriesArchived: 0,
        tokensSaved: 0,
        lspQueriesRun: 0,
        lspErrors: 0,
        sessionId,
        timestamp: new Date().toISOString(),
    }

    try {
        // Phase 1: Extraction
        logger.info("[Dream] Phase 1: Extracting insights...")
        const insights = await extractInsights(sessionId, context, config, focus)
        metrics.insightsExtracted = insights.length
        logger.debug(`[Dream] Extracted ${insights.length} insights`)

        // Phase 2: Distillation
        logger.info("[Dream] Phase 2: Distilling entries...")
        const entries = await distillEntries(insights, sessionId, config)
        metrics.insightsDistilled = entries.length
        logger.debug(`[Dream] Distilled to ${entries.length} entries`)

        // Phase 3: Application (write to AGENTS.md)
        logger.info("[Dream] Phase 3: Writing to AGENTS.md...")
        const writeResult = await applyToAgentsMd(entries, sessionId, context)
        metrics.entriesAdded = writeResult.entriesAdded
        metrics.entriesMerged = writeResult.mergedEntries
        metrics.entriesArchived = writeResult.archivedEntries
        metrics.tokensSaved = writeResult.tokensEstimated
        logger.debug(
            `[Dream] Added ${writeResult.entriesAdded}, merged ${writeResult.mergedEntries}, archived ${writeResult.archivedEntries}`,
        )

        // Phase 4: Context Injection
        logger.info("[Dream] Phase 4: Injecting context...")
        const contextSummary = await injectContextMemory(sessionId, context, config)
        logger.debug(`[Dream] Context injected (${contextSummary.length} chars)`)

        // Update metrics
        metrics.durationMs = Date.now() - startTime

        logger.info(
            `[Dream] Complete: ${metrics.durationMs}ms, ` +
                `${metrics.insightsExtracted} insights, ` +
                `${metrics.entriesAdded} entries`,
        )

        return {
            metrics,
            insights,
            entries,
            writeResult,
            contextSummary,
            success: true,
        }
    } catch (err) {
        metrics.durationMs = Date.now() - startTime
        const error = err instanceof Error ? err.message : String(err)
        logger.error(`[Dream] Failed: ${error}`)

        return {
            metrics,
            insights: [],
            entries: [],
            writeResult: {
                entriesAdded: 0,
                mergedEntries: 0,
                archivedEntries: 0,
                tokensEstimated: 0,
                agentsPath: "",
            },
            contextSummary: "",
            success: false,
            error,
        }
    }
}

/**
 * Phase 1: Extract insights from recent messages, LSP, patterns
 */
async function extractInsights(
    sessionId: string,
    context: PluginContext,
    config: DreamConfig,
    focus?: string,
): Promise<Insight[]> {
    // Import extraction module
    const { extractInsightsFromMessages } = await import("./extractors/messages")

    // Get recent messages from context
    const messages = context.messages || []

    // Extract
    const insights = await extractInsightsFromMessages(messages, context, config, focus)

    // Sort by severity and limit to maxEntriesPerRun
    return insights.sort((a, b) => b.severity - a.severity).slice(0, config.maxEntriesPerRun)
}

/**
 * Phase 2: Distill insights into formatted entries with symbol notation
 */
async function distillEntries(
    insights: Insight[],
    sessionId: string,
    config: DreamConfig,
): Promise<DistilledEntry[]> {
    // Import distiller
    const { distillInsights } = await import("./distillers/distiller")

    // Get existing AGENTS.md entries if file exists
    const existingAgents = await loadExistingAgentsFile()

    // Distill
    const entries = await distillInsights(insights, existingAgents, sessionId, config)

    return entries
}

/**
 * Phase 3: Apply distilled entries to AGENTS.md
 */
async function applyToAgentsMd(
    entries: DistilledEntry[],
    sessionId: string,
    context: PluginContext,
): Promise<{
    entriesAdded: number
    mergedEntries: number
    archivedEntries: number
    tokensEstimated: number
    agentsPath: string
    archivePath?: string
}> {
    // Import writer
    const { writeToAgentsFile } = await import("./writers/agents-writer")

    // Get project root from context
    const projectRoot = getProjectRoot(context)

    // Write
    return writeToAgentsFile(entries, projectRoot, sessionId)
}

/**
 * Phase 4: Inject dream summary into context for long-term memory
 */
async function injectContextMemory(
    sessionId: string,
    context: PluginContext,
    config: DreamConfig,
): Promise<string> {
    if (!config.injectIntoContext) {
        return "" // Injection disabled
    }

    // Import injector
    const { injectDreamContext } = await import("./injectors/context-injector")

    // Get AGENTS.md content
    const agentsContent = await loadExistingAgentsFile()

    // Inject
    return injectDreamContext(agentsContent, context, config)
}

/**
 * Load existing AGENTS.md file content
 */
async function loadExistingAgentsFile(): Promise<string> {
    const { readFile } = await import("fs/promises")
    const { join } = await import("path")

    try {
        const projectRoot = process.cwd() // In real implementation, get from context
        const agentsPath = join(projectRoot, ".opencode", "AGENTS.md")
        return await readFile(agentsPath, "utf-8")
    } catch {
        return "" // File doesn't exist yet
    }
}

/**
 * Get project root from context
 */
function getProjectRoot(context: PluginContext): string {
    // In real implementation, extract from context
    // For now, return cwd
    return process.cwd()
}

/**
 * Export module for plugin integration
 */
export const DreamConsolidation = {
    runDreamConsolidation,
    extractInsights,
    distillEntries,
    applyToAgentsMd,
    injectContextMemory,
}
