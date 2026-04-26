/**
 * lib/dream/commands.ts
 *
 * Phase 4.1: /dream command handler
 * Manual triggers and user-facing dream operations
 *
 * Subcommands:
 * - /dream stats       : Show consolidation metrics
 * - /dream run         : Trigger manual consolidation
 * - /dream preview     : Preview pending entries before consolidation
 * - /dream archive     : Archive old entries immediately
 * - /dream help        : Show help text
 */

import type { DreamConfig } from "./types"
import { logger } from "../logger"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"

// Generic context type for plugin context
type PluginContext = any

/**
 * Handle /dream command dispatcher
 */
export async function handleDreamCommand(
    args: Record<string, unknown>,
    context: PluginContext,
    config: DreamConfig,
): Promise<string> {
    const subcommand = (args.subcommand as string | undefined)?.toLowerCase() || "help"
    const projectRoot = getProjectRoot(context)

    try {
        switch (subcommand) {
            case "stats":
                return await handleStats(projectRoot, config)

            case "run":
                return await handleRun(context, config, projectRoot)

            case "preview":
                return await handlePreview(projectRoot, config)

            case "archive":
                return await handleArchive(projectRoot, config)

            case "help":
            default:
                return formatHelp()
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[Dream] Command failed: ${message}`)
        return `❌ Error: ${message}`
    }
}

/**
 * Format a metrics row with proper alignment
 */
function formatMetricRow(label: string, value: string | number, width: number = 50): string {
    const valueStr = String(value)
    const dotsCount = Math.max(0, width - label.length - valueStr.length - 4)
    return `│ ${label}${".".repeat(dotsCount)} ${valueStr} │`
}

/**
 * Format a category row with count
 */
function formatCategoryRow(category: string, count: number, width: number = 50): string {
    const countStr = String(count)
    const padding = Math.max(0, width - category.length - countStr.length - 4)
    return `│  ${category}${" ".repeat(padding)}${countStr} │`
}

/**
 * Build TUI stats box with rounded corners
 */
function buildStatsBox(
    activeCount: number,
    archivedCount: number,
    categoryCount: Record<string, number>,
    config: DreamConfig,
): string {
    const width = 50
    const lines: string[] = []

    // Header
    lines.push("╭" + "─".repeat(width - 2) + "╮")
    lines.push(`│ 📊 Dream Consolidation Statistics${" ".repeat(width - 34)} │`)
    lines.push("├" + "─".repeat(width - 2) + "┤")

    // Main metrics
    lines.push(formatMetricRow("Active Entries", activeCount, width))
    lines.push(formatMetricRow("Archived Entries", archivedCount, width))
    lines.push(formatMetricRow("Total Entries", activeCount + archivedCount, width))

    // Categories
    if (Object.keys(categoryCount).length > 0) {
        lines.push("├" + "─".repeat(width - 2) + "┤")
        for (const [cat, count] of Object.entries(categoryCount).sort()) {
            lines.push(formatCategoryRow(`${cat}:`, count, width))
        }
    }

    // Settings
    lines.push("├" + "─".repeat(width - 2) + "┤")
    lines.push(formatMetricRow("Archive Threshold", config.archiveThreshold, width))
    lines.push(formatMetricRow("Max per Run", config.maxEntriesPerRun, width))
    lines.push(formatMetricRow("Inject Context", config.injectIntoContext ? "Yes" : "No", width))

    // Footer
    lines.push("╰" + "─".repeat(width - 2) + "╯")

    return lines.join("\n")
}

/**
 * Build TUI consolidation result box
 */
function buildResultBox(result: any): string {
    const width = 55
    const lines: string[] = []
    const m = result.metrics

    lines.push("╭" + "─".repeat(width - 2) + "╮")
    lines.push(`│ ✅ Dream Consolidation Complete${" ".repeat(width - 34)} │`)
    lines.push("├" + "─".repeat(width - 2) + "┤")
    lines.push(formatMetricRow("Duration", `${m.durationMs}ms`, width))
    lines.push(formatMetricRow("Insights Extracted", m.insightsExtracted, width))
    lines.push(formatMetricRow("Insights Distilled", m.insightsDistilled, width))
    lines.push(formatMetricRow("Entries Added", m.entriesAdded, width))
    lines.push(formatMetricRow("Entries Merged", m.entriesMerged, width))
    lines.push(formatMetricRow("Entries Archived", m.entriesArchived, width))
    lines.push("├" + "─".repeat(width - 2) + "┤")

    const pathLabel = "📝 Written to:"
    const pathValue = result.writeResult.agentsPath.substring(
        Math.max(0, result.writeResult.agentsPath.length - (width - 20)),
    )
    lines.push(
        `│ ${pathLabel.padEnd(15)} ${pathValue.substring(0, width - 20).padEnd(width - 20)} │`,
    )

    if (result.writeResult.archivePath) {
        const archLabel = "📦 Archived to:"
        const archValue = result.writeResult.archivePath.substring(
            Math.max(0, result.writeResult.archivePath.length - (width - 20)),
        )
        lines.push(
            `│ ${archLabel.padEnd(15)} ${archValue.substring(0, width - 20).padEnd(width - 20)} │`,
        )
    }

    lines.push("╰" + "─".repeat(width - 2) + "╯")

    return lines.join("\n")
}

/**
 * /dream stats - Show consolidation metrics
 */
async function handleStats(projectRoot: string, config: DreamConfig): Promise<string> {
    const agentsPath = join(projectRoot, ".opencode", "AGENTS.md")
    const archivePath = join(projectRoot, ".opencode", "AGENTS-archive.md")

    try {
        const agentsContent = await readFile(agentsPath, "utf-8").catch(() => "")
        const archiveContent = await readFile(archivePath, "utf-8").catch(() => "")

        const activeEntries = parseMarkdownEntries(agentsContent)
        const archivedEntries = parseMarkdownEntries(archiveContent)

        // Count by category
        const categoryCount: Record<string, number> = {}
        for (const entry of activeEntries) {
            categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1
        }

        return buildStatsBox(activeEntries.length, archivedEntries.length, categoryCount, config)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return `⚠️  No AGENTS.md found. Run \`/dream run\` to create it.\n\nError: ${message}`
    }
}

/**
 * /dream run - Trigger manual consolidation
 */
async function handleRun(
    context: PluginContext,
    config: DreamConfig,
    projectRoot: string,
): Promise<string> {
    logger.info("[Dream] Manual consolidation triggered via /dream run")

    try {
        // Import the main consolidation function
        const { runDreamConsolidation } = await import("./index")

        const sessionId = context.sessionId || "manual-session"
        const result = await runDreamConsolidation(sessionId, context, config)

        if (!result.success) {
            return `❌ Consolidation failed: ${result.error || "Unknown error"}`
        }

        return buildResultBox(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[Dream] Run failed: ${message}`)
        return `❌ Consolidation failed: ${message}`
    }
}

/**
 * /dream preview - Preview pending entries before consolidation
 */
async function handlePreview(projectRoot: string, config: DreamConfig): Promise<string> {
    logger.info("[Dream] Previewing pending consolidation entries")

    try {
        const agentsPath = join(projectRoot, ".opencode", "AGENTS.md")
        const agentsContent = await readFile(agentsPath, "utf-8").catch(() => "")
        const entries = parseMarkdownEntries(agentsContent)

        const width = 50
        const lines: string[] = []
        lines.push("╭" + "─".repeat(width - 2) + "╮")
        lines.push(`│ 🔮 Dream Consolidation Preview${" ".repeat(width - 31)} │`)
        lines.push("├" + "─".repeat(width - 2) + "┤")
        lines.push(formatMetricRow("Total Entries", entries.length, width))
        lines.push(formatMetricRow("Max per Run", config.maxEntriesPerRun, width))
        lines.push(formatMetricRow("Archive Trigger", config.archiveThreshold, width))

        if (entries.length > 0) {
            lines.push("├" + "─".repeat(width - 2) + "┤")
            lines.push(`│ 📋 Recent entries: ${" ".repeat(width - 21)} │`)
            const recent = entries.slice(-5)
            for (const entry of recent) {
                const label = `${entry.category}:`.substring(0, width - 10)
                lines.push(`│  • ${label.padEnd(width - 6)} │`)
            }
        }

        lines.push("├" + "─".repeat(width - 2) + "┤")
        lines.push(`│ Run \`/dream run\` to consolidate these entries.${" ".repeat(width - 48)} │`)
        lines.push("╰" + "─".repeat(width - 2) + "╯")

        return lines.join("\n")
    } catch (error) {
        return `ℹ️  No entries yet. Run \`/dream run\` to start consolidation.`
    }
}

/**
 * /dream archive - Archive old entries immediately
 */
async function handleArchive(projectRoot: string, config: DreamConfig): Promise<string> {
    logger.info("[Dream] Archiving old entries")

    try {
        const agentsPath = join(projectRoot, ".opencode", "AGENTS.md")
        const archivePath = join(projectRoot, ".opencode", "AGENTS-archive.md")

        const agentsContent = await readFile(agentsPath, "utf-8").catch(() => "")
        const entries = parseMarkdownEntries(agentsContent)

        if (entries.length <= config.archiveThreshold) {
            const width = 50
            const lines: string[] = []
            lines.push("ℹ️  No archiving needed.")
            lines.push(`Current: ${entries.length}, Threshold: ${config.archiveThreshold}`)
            return lines.join("\n")
        }

        // Archive old entries
        const toArchive = entries.slice(config.archiveThreshold)
        const toKeep = entries.slice(0, config.archiveThreshold)

        // Build archive content
        const archiveMarkdown = buildArchiveMarkdown(toArchive)
        const activeMarkdown = buildActiveMarkdown(toKeep)

        // Write files
        await writeFile(agentsPath, activeMarkdown, "utf-8")
        await writeFile(archivePath, archiveMarkdown, "utf-8")

        const width = 50
        const lines: string[] = []
        lines.push("╭" + "─".repeat(width - 2) + "╮")
        lines.push(`│ ✅ Archival Complete${" ".repeat(width - 21)} │`)
        lines.push("├" + "─".repeat(width - 2) + "┤")
        lines.push(formatMetricRow("Archived", toArchive.length, width))
        lines.push(formatMetricRow("Active Remaining", toKeep.length, width))
        lines.push("╰" + "─".repeat(width - 2) + "╯")

        return lines.join("\n")
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[Dream] Archive failed: ${message}`)
        return `❌ Archiving failed: ${message}`
    }
}

/**
 * Parse markdown entries from AGENTS.md format
 */
function parseMarkdownEntries(
    content: string,
): Array<{ category: string; content: string; sessionId: string }> {
    const entries: Array<{ category: string; content: string; sessionId: string }> = []
    const lines = content.split("\n")

    for (const line of lines) {
        // Match: * **category**: content *(sessionId)*
        const match = line.match(/^\*\s+\*\*(.+?)\*\*:\s+(.+?)\s+\*\((.+?)\)\*/)
        if (match) {
            entries.push({
                category: match[1],
                content: match[2],
                sessionId: match[3],
            })
        }
    }

    return entries
}

/**
 * Build markdown for active AGENTS.md
 */
function buildActiveMarkdown(
    entries: Array<{ category: string; content: string; sessionId: string }>,
): string {
    const lines: string[] = []
    lines.push("# AGENTS.md — Technical Consolidation")
    lines.push("")
    lines.push(`Last updated: ${new Date().toISOString()}`)
    lines.push("")
    lines.push("## Technical Backlog")
    lines.push("")

    // Group by category
    const byCategory: Record<string, typeof entries> = {}
    for (const entry of entries) {
        if (!byCategory[entry.category]) byCategory[entry.category] = []
        byCategory[entry.category].push(entry)
    }

    // Output by category
    for (const [category, categoryEntries] of Object.entries(byCategory)) {
        lines.push(`### ${category[0].toUpperCase()}${category.slice(1)}`)
        lines.push("")
        for (const entry of categoryEntries) {
            lines.push(`* **${entry.category}**: ${entry.content} *(${entry.sessionId})*`)
        }
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Build markdown for archive
 */
function buildArchiveMarkdown(
    entries: Array<{ category: string; content: string; sessionId: string }>,
): string {
    const lines: string[] = []
    lines.push("# AGENTS-archive.md — Archived Technical Entries")
    lines.push("")
    lines.push(`Last updated: ${new Date().toISOString()}`)
    lines.push("")

    // Group by category
    const byCategory: Record<string, typeof entries> = {}
    for (const entry of entries) {
        if (!byCategory[entry.category]) byCategory[entry.category] = []
        byCategory[entry.category].push(entry)
    }

    // Output by category
    for (const [category, categoryEntries] of Object.entries(byCategory)) {
        lines.push(`## ${category[0].toUpperCase()}${category.slice(1)}`)
        lines.push("")
        for (const entry of categoryEntries) {
            lines.push(`* **${entry.category}**: ${entry.content} *(${entry.sessionId})*`)
        }
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Get project root from context
 */
function getProjectRoot(context: PluginContext): string {
    // Extract from context workspace root or use cwd
    return (context as any).workspaceRoot || process.cwd()
}

/**
 * Format help text
 */
function formatHelp(): string {
    const lines: string[] = []
    lines.push("🌙 Dream Consolidation Commands")
    lines.push("")
    lines.push("Usage: /dream [subcommand]")
    lines.push("")
    lines.push("Subcommands:")
    lines.push("  stats      Show consolidation metrics and entry counts")
    lines.push("  run        Trigger manual consolidation of insights")
    lines.push("  preview    Preview pending entries before consolidation")
    lines.push("  archive    Archive old entries immediately")
    lines.push("  help       Show this help message")
    lines.push("")
    lines.push("Examples:")
    lines.push("  /dream stats       # View current metrics")
    lines.push("  /dream run         # Consolidate insights")
    lines.push("  /dream archive     # Archive entries over threshold")

    return lines.join("\n")
}
