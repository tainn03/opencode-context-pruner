/**
 * lib/dream/writers/agents-writer.ts
 *
 * Phase 3.1: Write distilled entries to AGENTS.md
 * Non-destructive updates with timestamping and archiving
 */

import { readFile, writeFile, mkdir } from "fs/promises"
import { join, dirname } from "path"
import { existsSync } from "fs"
import type { DistilledEntry, WriteResult } from "../types"
import { logger } from "../../logger"

const AGENTS_PATH = ".opencode/AGENTS.md"
const AGENTS_ARCHIVE_PATH = ".opencode/AGENTS-archive.md"
const TECHNICAL_BACKLOG_SECTION = "## Technical Backlog"

/**
 * Write distilled entries to AGENTS.md
 * Non-destructive updates with timestamping and archiving
 */
export async function writeToAgentsFile(
    entries: DistilledEntry[],
    projectRoot: string,
    sessionId: string,
    archiveThreshold: number = 50,
): Promise<WriteResult> {
    const agentsPath = join(projectRoot, AGENTS_PATH)
    const archivePath = join(projectRoot, AGENTS_ARCHIVE_PATH)

    let entriesAdded = 0
    let mergedEntries = 0
    let entriesArchived = 0

    try {
        // 1. Ensure .opencode directory exists
        const opencodePath = dirname(agentsPath)
        if (!existsSync(opencodePath)) {
            await mkdir(opencodePath, { recursive: true })
            logger.debug(`[Dream] Created .opencode directory at ${opencodePath}`)
        }

        // 2. Read existing AGENTS.md (or create)
        let content = ""
        if (existsSync(agentsPath)) {
            content = await readFile(agentsPath, "utf-8")
        }

        // 3. Parse existing entries
        const existingEntries = parseMarkdownEntries(content)
        logger.debug(`[Dream] Parsed ${existingEntries.length} existing entries`)

        // 4. Insert new distilled entries
        for (const entry of entries) {
            const match = existingEntries.find(
                (e) => e.category === entry.category && e.content === entry.content,
            )

            if (match) {
                // Entry already exists, skip
                logger.debug(
                    `[Dream] Skipping duplicate entry: ${entry.content.substring(0, 40)}...`,
                )
            } else {
                existingEntries.push({
                    content: entry.content,
                    category: entry.category,
                    timestamp: new Date().toISOString(),
                    sessionId,
                })

                if (entry.isNew) {
                    entriesAdded++
                } else {
                    mergedEntries++
                }
            }
        }

        // 5. Archive if threshold exceeded
        if (existingEntries.length > archiveThreshold) {
            const entriesToArchive = existingEntries.splice(
                0,
                existingEntries.length - archiveThreshold,
            )
            entriesArchived = entriesToArchive.length

            // Ensure archive directory exists
            const archiveDir = dirname(archivePath)
            if (!existsSync(archiveDir)) {
                await mkdir(archiveDir, { recursive: true })
            }

            // Write to archive
            let archiveContent = ""
            if (existsSync(archivePath)) {
                archiveContent = await readFile(archivePath, "utf-8")
            }

            // Append archived entries
            archiveContent += `\n\n# Archived ${new Date().toISOString()}\n\n`
            for (const entry of entriesToArchive) {
                archiveContent += `* **${entry.category}**: ${entry.content} *(${entry.sessionId})*\n`
            }

            await writeFile(archivePath, archiveContent, "utf-8")
            logger.info(`[Dream] Archived ${entriesArchived} entries to ${AGENTS_ARCHIVE_PATH}`)
        }

        // 6. Build new AGENTS.md content
        const newContent = buildAgentsMarkdown(existingEntries, sessionId)

        // 7. Write AGENTS.md
        await writeFile(agentsPath, newContent, "utf-8")
        logger.info(
            `[Dream] Wrote ${agentsPath}: ${entriesAdded} added, ${mergedEntries} merged, ${entriesArchived} archived`,
        )

        // 8. Calculate estimated tokens (rough estimate)
        const tokensEstimated = newContent.length / 4 // ~1 token per 4 chars

        return {
            entriesAdded,
            mergedEntries,
            archivedEntries: entriesArchived,
            tokensEstimated: Math.round(tokensEstimated),
            agentsPath,
            archivePath: entriesArchived > 0 ? archivePath : undefined,
        }
    } catch (err) {
        logger.error(
            `[Dream] Failed to write AGENTS.md: ${err instanceof Error ? err.message : String(err)}`,
        )
        throw err
    }
}

/**
 * Parse markdown entries from AGENTS.md content
 */
function parseMarkdownEntries(content: string): Array<{
    content: string
    category: string
    timestamp: string
    sessionId: string
}> {
    const entries: Array<{
        content: string
        category: string
        timestamp: string
        sessionId: string
    }> = []

    // Split by lines
    const lines = content.split("\n")

    for (const line of lines) {
        // Match: * **category**: content
        const match = line.match(/^\* \*\*([^\*]+)\*\*: (.+?)(?:\s*\*\(([^\)]+)\)\*)?$/)

        if (match) {
            const [, category, entryContent, sessionId] = match

            entries.push({
                content: entryContent.trim(),
                category: category.trim(),
                timestamp: new Date().toISOString(),
                sessionId: sessionId || "unknown",
            })
        }
    }

    return entries
}

/**
 * Build new AGENTS.md markdown content
 */
function buildAgentsMarkdown(
    entries: Array<{
        content: string
        category: string
        timestamp: string
        sessionId: string
    }>,
    sessionId: string,
): string {
    let markdown = `# AGENTS.md — Technical Consolidation

> Auto-generated by Dream Consolidation engine
> Last updated: ${new Date().toISOString()}

${TECHNICAL_BACKLOG_SECTION}

`

    // Group by category
    const byCategory = new Map<string, typeof entries>()
    for (const entry of entries) {
        if (!byCategory.has(entry.category)) {
            byCategory.set(entry.category, [])
        }
        byCategory.get(entry.category)!.push(entry)
    }

    // Write by category
    const categoryOrder = [
        "security",
        "architecture",
        "bug",
        "performance",
        "refactor",
        "dependency",
        "error",
        "other",
    ]

    for (const category of categoryOrder) {
        const categoryEntries = byCategory.get(category)
        if (!categoryEntries || categoryEntries.length === 0) continue

        markdown += `### ${capitalizeCategory(category)}\n\n`
        for (const entry of categoryEntries) {
            markdown += `* **${entry.category}**: ${entry.content} *(${entry.sessionId})*\n`
        }
        markdown += "\n"
    }

    return markdown
}

/**
 * Capitalize category for display
 */
function capitalizeCategory(category: string): string {
    return category
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

/**
 * Export for testing
 */
export const WriterUtils = {
    parseMarkdownEntries,
    buildAgentsMarkdown,
    capitalizeCategory,
}
