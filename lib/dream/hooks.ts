/**
 * lib/dream/hooks.ts
 *
 * Plugin lifecycle integration for Dream Consolidation
 * Handles hook registration and trigger points
 */

// Generic types for hook support
type Plugin = any
type HookEvent = any
type DreamState = any
type PluginContext = any

import type { DreamConfig, DreamConsolidationResult } from "./types"
import { logger } from "../logger"

/**
 * Register Dream Consolidation hook
 * Runs after DCP compression/compaction
 */
export async function registerDreamHook(plugin: Plugin, config: DreamConfig): Promise<void> {
    if (!config.enabled) {
        logger.debug("[Dream] Disabled in config")
        return
    }

    /**
     * Hook: experimental.session.compacting
     * Fires after DCP applies compression/compaction
     * Perfect timing: context is pruned, before next turn
     */
    plugin.hook("experimental.session.compacting", async (event: any, context: any) => {
        try {
            await handleCompressionComplete(event, context, config)
        } catch (err) {
            logger.error(`[Dream] Hook failed: ${err instanceof Error ? err.message : String(err)}`)
            // Non-fatal: never block compression
        }
    })

    logger.info("[Dream] Hook registered: experimental.session.compacting")
}

/**
 * Alternative hook for custom context hook (fallback if compacting not available)
 */
export async function registerDreamContextHook(plugin: Plugin, config: DreamConfig): Promise<void> {
    if (!config.enabled) {
        return
    }

    /**
     * Hook: experimental.chat.messages.transform
     * Fires after message transformation, before sending to model
     * Runs after all pruning/compression complete
     */
    plugin.hook("experimental.chat.messages.transform", async (event: any, context: any) => {
        // Only run on idle sessions (not every turn)
        if (shouldTriggerDreamOnIdle(event, context, config)) {
            try {
                await handleIdleTimeout(event, context, config)
            } catch (err) {
                logger.error(
                    `[Dream] Idle trigger failed: ${err instanceof Error ? err.message : String(err)}`,
                )
            }
        }
    })

    logger.info("[Dream] Alt hook registered: experimental.chat.messages.transform (idle)")
}

/**
 * Handle compression complete event
 */
async function handleCompressionComplete(
    event: HookEvent,
    context: PluginContext,
    config: DreamConfig,
): Promise<void> {
    // Check if dream should trigger on compress
    if (!config.triggerOn.includes("compress")) {
        return
    }

    // Check if subagent (skip by default)
    if (isSubAgent(event, context) && !config.enabled) {
        logger.debug("[Dream] Skipping in subagent session")
        return
    }

    logger.info("[Dream] Triggered by compression complete")

    // Import here to avoid circular dependencies
    const { runDreamConsolidation } = await import("./index")

    const result = await runDreamConsolidation(event.sessionId, context, config)

    if (result.success) {
        logger.info(
            `[Dream] Success: ${result.metrics.insightsExtracted} insights, ` +
                `${result.metrics.entriesAdded} entries, ` +
                `${result.metrics.tokensSaved} tokens saved`,
        )
    } else {
        logger.warn(`[Dream] Failed: ${result.error}`)
    }
}

/**
 * Handle idle timeout trigger
 */
async function handleIdleTimeout(
    event: HookEvent,
    context: PluginContext,
    config: DreamConfig,
): Promise<void> {
    // Check if dream should trigger on idle
    if (!config.triggerOn.includes("idle")) {
        return
    }

    // Check time since last dream run
    const dreamState = getDreamState(event, context)
    const timeSinceLastDream = Date.now() - (dreamState.lastDreamRun || 0)

    if (timeSinceLastDream < config.idleTimeout) {
        return // Not idle enough yet
    }

    logger.info(`[Dream] Triggered by idle timeout (${timeSinceLastDream}ms)`)

    const { runDreamConsolidation } = await import("./index")

    await runDreamConsolidation(event.sessionId, context, config)
}

/**
 * Should trigger dream on idle
 * Returns true if session has been idle for the configured timeout
 */
function shouldTriggerDreamOnIdle(
    event: HookEvent,
    context: PluginContext,
    config: DreamConfig,
): boolean {
    if (!config.triggerOn.includes("idle")) {
        return false
    }

    const dreamState = getDreamState(event, context)
    const timeSinceLastDream = Date.now() - (dreamState.lastDreamRun || 0)

    return timeSinceLastDream >= config.idleTimeout
}

/**
 * Check if this is a subagent session
 */
function isSubAgent(event: HookEvent, context: PluginContext): boolean {
    // Check event for subagent flag
    if ("isSubAgent" in event && event.isSubAgent === true) {
        return true
    }

    // Check context for subagent indicator
    if (context.sessionId?.startsWith("subagent-")) {
        return true
    }

    return false
}

/**
 * Get dream state from session persistence
 */
function getDreamState(event: HookEvent, context: PluginContext): DreamState {
    // Would load from lib/state/persistence.ts in real implementation
    // For now, return default
    return {
        dreamEntryCount: 0,
        pendingDreamRun: false,
        sessionId: event.sessionId || "unknown",
    }
}

/**
 * Register manual command handler
 * User can trigger /dream manually
 */
export async function registerDreamCommand(plugin: Plugin, config: DreamConfig): Promise<void> {
    if (!config.enabled) {
        return
    }

    plugin.command("/dream", {
        description: "Dream Consolidation: distill insights into AGENTS.md",
        args: plugin.schema.object({
            subcommand: plugin.schema.enum(["stats", "run", "preview", "archive"]).optional(),
            focus: plugin.schema.string().optional(),
        }),
        execute: async (args: any, context: any) => {
            // Import here to avoid circular dependencies
            const { handleDreamCommand } = await import("./commands")

            return handleDreamCommand(args, context, config)
        },
    })

    logger.info("[Dream] Command registered: /dream")
}

/**
 * Integration lifecycle
 * Call from index.ts during plugin initialization
 */
export async function initializeDreamIntegration(
    plugin: Plugin,
    config: DreamConfig,
): Promise<void> {
    logger.info("[Dream] Initializing integration")

    // Register primary hook (compression trigger)
    await registerDreamHook(plugin, config)

    // Register fallback hook (idle trigger)
    await registerDreamContextHook(plugin, config)

    // Register manual command
    await registerDreamCommand(plugin, config)

    logger.info("[Dream] Integration complete")
}

/**
 * Trigger dream manually from command
 */
export async function triggerDreamManual(
    sessionId: string,
    context: PluginContext,
    config: DreamConfig,
    focus?: string,
): Promise<DreamConsolidationResult> {
    logger.info(`[Dream] Manual trigger: focus="${focus || "all"}"`)

    const { runDreamConsolidation } = await import("./index")

    return runDreamConsolidation(sessionId, context, config, focus)
}

/**
 * Rate limiting for dream runs
 * Prevents excessive runs in short timespan
 */
export function checkDreamRateLimit(
    dreamState: DreamState,
    minIntervalMs: number = 5 * 60 * 1000, // 5 minutes default
): boolean {
    const timeSinceLastRun = Date.now() - (dreamState.lastDreamRun || 0)
    return timeSinceLastRun >= minIntervalMs
}
