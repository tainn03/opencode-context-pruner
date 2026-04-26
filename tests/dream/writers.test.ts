/**
 * tests/dream/writers.test.ts
 *
 * Test Dream Phase 3.1: AGENTS.md writer
 */

import { test } from "node:test"
import { strict as assert } from "node:assert"
import { mkdir, writeFile, readFile, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { writeToAgentsFile, WriterUtils } from "../../lib/dream/writers/agents-writer"
import type { DistilledEntry } from "../../lib/dream/types"

// Test fixtures
const testDir = join(tmpdir(), `dream-writer-test-${Date.now()}`)

async function setupTestDir() {
    await mkdir(testDir, { recursive: true })
}

async function cleanupTestDir() {
    try {
        await rm(testDir, { recursive: true, force: true })
    } catch (e) {
        // Ignore cleanup errors
    }
}

test("Dream Writer: Create AGENTS.md with new entries", async () => {
    await setupTestDir()

    try {
        const entries: DistilledEntry[] = [
            {
                id: "entry1",
                content: "SQL injection fixed with prepared statements ✅",
                category: "security",
                severity: 95,
                isNew: true,
                timestamp: new Date().toISOString(),
                sessionId: "test-session",
            },
            {
                id: "entry2",
                content: "Database queries optimized with indexing ✅",
                category: "performance",
                severity: 80,
                isNew: true,
                timestamp: new Date().toISOString(),
                sessionId: "test-session",
            },
        ]

        const result = await writeToAgentsFile(entries, testDir, "test-session")

        assert.equal(result.entriesAdded, 2, "Should add 2 new entries")
        assert.equal(result.mergedEntries, 0, "No merges on creation")
        assert.ok(result.agentsPath, "Should return AGENTS.md path")

        // Verify file exists and contains entries
        const agentsFile = join(testDir, ".opencode", "AGENTS.md")
        const content = await readFile(agentsFile, "utf-8")
        assert.ok(content.includes("Security"), "Should have Security section")
        assert.ok(content.includes("SQL injection"), "Should contain first entry")
        assert.ok(content.includes("Database queries"), "Should contain second entry")
    } finally {
        await cleanupTestDir()
    }
})

test("Dream Writer: Deduplicate existing entries", async () => {
    await setupTestDir()

    try {
        // Create initial AGENTS.md
        const initialEntries: DistilledEntry[] = [
            {
                id: "entry1",
                content: "Auth refactored for clarity ✅",
                category: "refactor",
                severity: 60,
                isNew: true,
                timestamp: new Date().toISOString(),
                sessionId: "session1",
            },
        ]

        let result = await writeToAgentsFile(initialEntries, testDir, "session1")
        assert.equal(result.entriesAdded, 1, "Should add initial entry")

        // Add same entry again
        result = await writeToAgentsFile(initialEntries, testDir, "session2")
        assert.equal(result.entriesAdded, 0, "Should not add duplicate")

        // Verify only one entry exists
        const agentsFile = join(testDir, ".opencode", "AGENTS.md")
        const content = await readFile(agentsFile, "utf-8")
        const matches = content.match(/Auth refactored/g) || []
        assert.equal(matches.length, 1, "Should have only one instance")
    } finally {
        await cleanupTestDir()
    }
})

test("Dream Writer: Parse markdown entries", async () => {
    const markdown = `## Technical Backlog

* **security**: SQL injection fixed ✅ *(session1)*
* **performance**: Query optimization ✅ *(session2)*
* **refactor**: Code cleanup ✅ *(session3)*
`

    const entries = WriterUtils.parseMarkdownEntries(markdown)

    assert.equal(entries.length, 3, "Should parse 3 entries")
    assert.equal(entries[0].category, "security")
    assert.equal(entries[0].sessionId, "session1")
    assert.ok(entries[0].content.includes("SQL injection"))
})

test("Dream Writer: Build markdown with categories", async () => {
    const entries = [
        {
            content: "SQL injection fixed ✅",
            category: "security",
            timestamp: new Date().toISOString(),
            sessionId: "test",
        },
        {
            content: "Query optimization ✅",
            category: "performance",
            timestamp: new Date().toISOString(),
            sessionId: "test",
        },
        {
            content: "Code cleanup ✅",
            category: "refactor",
            timestamp: new Date().toISOString(),
            sessionId: "test",
        },
    ]

    const markdown = WriterUtils.buildAgentsMarkdown(entries, "test-session")

    assert.ok(markdown.includes("Security"), "Should include Security section")
    assert.ok(markdown.includes("Performance"), "Should include Performance section")
    assert.ok(markdown.includes("Refactor"), "Should include Refactor section")
    assert.ok(markdown.includes("SQL injection"), "Should include security entry")
    assert.ok(markdown.includes("Query optimization"), "Should include performance entry")
})

test("Dream Writer: Archive old entries when threshold exceeded", async () => {
    await setupTestDir()

    try {
        // Create many entries to trigger archiving
        const entries: DistilledEntry[] = []
        for (let i = 0; i < 60; i++) {
            entries.push({
                id: `entry${i}`,
                content: `Entry ${i}: Sample content ✅`,
                category: "other",
                severity: 50 + (i % 50),
                isNew: true,
                timestamp: new Date().toISOString(),
                sessionId: "test-session",
            })
        }

        const result = await writeToAgentsFile(entries, testDir, "test-session", 50)

        assert.equal(result.entriesAdded, 60, "Should add all 60 entries")
        assert.equal(result.archivedEntries, 10, "Should archive 10 entries (keeping 50)")
        assert.ok(result.archivePath, "Should return archive path")

        // Verify archive file exists
        const archiveFile = join(testDir, ".opencode", "AGENTS-archive.md")
        const archiveContent = await readFile(archiveFile, "utf-8")
        assert.ok(archiveContent.includes("Archived"), "Should have archive header")
        assert.ok(archiveContent.includes("Entry 0"), "Should contain archived entries")
    } finally {
        await cleanupTestDir()
    }
})

test("Dream Writer: Capitalize category names", async () => {
    assert.equal(WriterUtils.capitalizeCategory("security"), "Security")
    assert.equal(WriterUtils.capitalizeCategory("bug"), "Bug")
    assert.equal(WriterUtils.capitalizeCategory("performance"), "Performance")
    assert.equal(WriterUtils.capitalizeCategory("error"), "Error")
})
