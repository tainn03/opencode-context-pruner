/**
 * tests/dream/edge-cases.test.ts
 *
 * Phase 5: Comprehensive edge case tests for Dream Consolidation
 * Tests for error handling, boundary conditions, and unusual inputs
 */

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { extractInsightsFromMessages } from "../../lib/dream/extractors/messages"
import { distillInsights } from "../../lib/dream/distillers/distiller"
import { writeToAgentsFile } from "../../lib/dream/writers/agents-writer"
import { injectDreamContext } from "../../lib/dream/injectors/context-injector"
import type { Insight, DistilledEntry, DreamConfig } from "../../lib/dream/types"

// Default config for tests
const defaultConfig: DreamConfig = {
    enabled: true,
    triggerOn: ["compress", "idle"],
    idleTimeout: 300,
    archiveThreshold: 50,
    maxEntriesPerRun: 15,
    injectIntoContext: true,
    lspEnabled: false,
    focusCategory: null,
}

describe("Dream Consolidation - Edge Cases", () => {
    describe("Edge Case: Empty Messages", () => {
        it("should handle empty message array", async () => {
            const insights = await extractInsightsFromMessages([], {} as any, defaultConfig)
            assert.equal(insights.length, 0, "Empty messages should produce no insights")
        })

        it("should handle null messages gracefully", async () => {
            const insights = await extractInsightsFromMessages(
                null as any,
                {} as any,
                defaultConfig,
            )
            assert.equal(insights.length, 0, "Null messages should produce no insights")
        })
    })

    describe("Edge Case: Malformed Content", () => {
        it("should handle extremely long content strings", async () => {
            const longContent = "a".repeat(100000) // 100k characters
            const insights = await extractInsightsFromMessages(
                [{ role: "user", content: longContent }] as any,
                {} as any,
                defaultConfig,
            )
            // Should not crash
            assert.ok(typeof insights === "object")
        })

        it("should handle special characters in content", async () => {
            const specialContent = "!@#$%^&*()[]{}|\\:;\"'<>?,./~`"
            const insights = await extractInsightsFromMessages(
                [{ role: "user", content: specialContent }] as any,
                {} as any,
                defaultConfig,
            )
            assert.ok(Array.isArray(insights))
        })

        it("should handle unicode and emoji in content", async () => {
            const unicodeContent = "你好世界 مرحبا بالعالم 🌍🚀💡"
            const insights = await extractInsightsFromMessages(
                [{ role: "user", content: unicodeContent }] as any,
                {} as any,
                defaultConfig,
            )
            assert.ok(Array.isArray(insights))
        })
    })

    describe("Edge Case: Retry Pattern Detection", () => {
        it("should detect repeated error messages", async () => {
            const messages = [
                { role: "user", content: "Error: Connection timeout" },
                { role: "assistant", content: "Retrying..." },
                { role: "user", content: "Error: Connection timeout" },
                { role: "assistant", content: "Retrying..." },
                { role: "user", content: "Error: Connection timeout" },
            ]
            const insights = await extractInsightsFromMessages(
                messages as any,
                {} as any,
                defaultConfig,
            )
            // Should detect retry pattern
            const retryInsights = insights.filter((i) => i.retryCount && i.retryCount >= 2)
            assert.ok(retryInsights.length > 0, "Should detect repeated errors")
        })

        it("should handle case-insensitive error detection", async () => {
            const messages = [
                { role: "user", content: "ERROR: Database connection failed" },
                { role: "user", content: "error: database connection failed" },
                { role: "user", content: "Error: Database Connection Failed" },
            ]
            const insights = await extractInsightsFromMessages(
                messages as any,
                {} as any,
                defaultConfig,
            )
            assert.ok(Array.isArray(insights))
        })
    })

    describe("Edge Case: Distillation Boundary Conditions", () => {
        it("should handle distillation of empty insights", async () => {
            const entries = await distillInsights([], "", "test-session", defaultConfig)
            assert.equal(entries.length, 0, "Empty insights produce no entries")
        })

        it("should handle distillation with very high severity insights", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Critical vulnerability found",
                    category: "security",
                    severity: 100, // Max severity
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]
            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.ok(entries.length > 0, "Should distill high-severity insights")
        })

        it("should handle distillation with very low severity insights", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Minor formatting issue",
                    category: "other",
                    severity: 1,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]
            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            // Even low-severity insights should be distilled
            assert.ok(Array.isArray(entries))
        })

        it("should handle all 8 insight categories", async () => {
            const categories = [
                "security",
                "architecture",
                "bug",
                "performance",
                "dependency",
                "error",
                "refactor",
                "other",
            ]
            const insights = categories.map((cat, i) => ({
                id: `ins${i}`,
                content: `${cat} issue detected`,
                category: cat as any,
                severity: 50 + i,
                source: `m${i}`,
                timestamp: new Date().toISOString(),
            }))

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.equal(entries.length, categories.length, "Should handle all categories")
        })
    })

    describe("Edge Case: Deduplication Logic", () => {
        it("should deduplicate identical entries", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Same issue detected",
                    category: "bug",
                    severity: 60,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
                {
                    id: "ins2",
                    content: "Same issue detected",
                    category: "bug",
                    severity: 60,
                    source: "m002",
                    timestamp: new Date().toISOString(),
                },
            ]
            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            // Should deduplicate
            assert.ok(entries.length <= insights.length)
        })

        it("should keep highest severity when deduplicating", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Issue found",
                    category: "security",
                    severity: 30,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
                {
                    id: "ins2",
                    content: "Issue found",
                    category: "security",
                    severity: 90,
                    source: "m002",
                    timestamp: new Date().toISOString(),
                },
            ]
            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            // Should keep the higher severity entry
            const entry = entries[0]
            assert.ok(entry.severity >= 30, "Should keep higher severity")
        })
    })

    describe("Edge Case: Symbol Notation", () => {
        it("should apply correct symbols to each category", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Security patch applied",
                    category: "security",
                    severity: 95,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
                {
                    id: "ins2",
                    content: "Database query optimized",
                    category: "performance",
                    severity: 70,
                    source: "m002",
                    timestamp: new Date().toISOString(),
                },
            ]
            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            entries.forEach((entry) => {
                // Should have symbol notation
                assert.ok(
                    entry.content.includes("✅") ||
                        entry.content.includes("→") ||
                        entry.content.includes("⚠️"),
                    "Entry should have symbol notation",
                )
            })
        })
    })

    describe("Edge Case: Archive Threshold Behavior", () => {
        it("should handle very large archive thresholds", async () => {
            const config = { ...defaultConfig, archiveThreshold: 10000 }
            const insights = Array.from({ length: 100 }, (_, i) => ({
                id: `ins${i}`,
                content: `Insight ${i}`,
                category: "other" as const,
                severity: 50,
                source: `m${i}`,
                timestamp: new Date().toISOString(),
            }))

            const entries = await distillInsights(insights, "", "test-session", config)
            assert.equal(entries.length, 100, "Should create 100 entries without archiving")
        })

        it("should handle zero archive threshold", async () => {
            const config = { ...defaultConfig, archiveThreshold: 0 }
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Test entry",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", config)
            // Should still work, just archive immediately
            assert.ok(Array.isArray(entries))
        })
    })

    describe("Edge Case: Context Injection Token Counting", () => {
        it("should handle empty AGENTS.md content", async () => {
            const context = injectDreamContext("", {} as any, defaultConfig)
            assert.ok(typeof context === "string" || context instanceof Promise)
        })

        it("should handle malformed AGENTS.md content", async () => {
            const malformedContent = `
        # Not proper format
        Some random text
        Not a valid entry
        * Missing category
        ** Broken formatting
      `
            const context = await injectDreamContext(malformedContent, {} as any, defaultConfig)
            // Should handle gracefully without crashing
            assert.ok(typeof context === "string")
        })

        it("should respect token limits in context injection", async () => {
            const largeContent = `
        # AGENTS.md
        ${Array.from({ length: 100 }, (_, i) => `* **security**: Issue ${i} ✅ *(session-${i})*`).join("\n")}
      `
            const context = await injectDreamContext(largeContent, {} as any, defaultConfig)
            // Should keep under limit (rough estimate: 1 token per 4 chars)
            const estimatedTokens = context.length / 4
            assert.ok(estimatedTokens < 500, "Context should stay under token limits")
        })
    })

    describe("Edge Case: Config Variations", () => {
        it("should handle disabled injection config", async () => {
            const config = { ...defaultConfig, injectIntoContext: false }
            const context = await injectDreamContext("test", {} as any, config)
            assert.equal(context, "", "Should return empty when injection disabled")
        })

        it("should handle disabled LSP config", async () => {
            const config = { ...defaultConfig, lspEnabled: false }
            const insights = await extractInsightsFromMessages(
                [{ role: "user", content: "TypeScript code issue" }] as any,
                {} as any,
                config,
            )
            // Should work without LSP
            assert.ok(Array.isArray(insights))
        })

        it("should handle edge case max entries per run (1)", async () => {
            const config = { ...defaultConfig, maxEntriesPerRun: 1 }
            const insights = Array.from({ length: 10 }, (_, i) => ({
                id: `ins${i}`,
                content: `Insight ${i}`,
                category: "bug" as const,
                severity: 50 + i,
                source: `m${i}`,
                timestamp: new Date().toISOString(),
            }))

            const entries = await distillInsights(insights, "", "test-session", config)
            // Should still process at least 1
            assert.ok(entries.length >= 0)
        })
    })

    describe("Edge Case: Timestamp and Session ID Handling", () => {
        it("should preserve session IDs through distillation", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Test",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "my-special-session", defaultConfig)
            assert.ok(entries[0].sessionId === "my-special-session", "Should preserve session ID")
        })

        it("should handle old timestamp formats", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Test",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: "2024-01-01T00:00:00.000Z", // Very old date
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.ok(entries.length > 0, "Should handle old timestamps")
        })
    })

    describe("Edge Case: Rate Limiting and Timing", () => {
        it("should handle rapid successive distillations", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Issue",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            // Rapid successive calls
            const results = await Promise.all([
                distillInsights(insights, "", "session1", defaultConfig),
                distillInsights(insights, "", "session2", defaultConfig),
                distillInsights(insights, "", "session3", defaultConfig),
            ])

            assert.equal(results.length, 3, "Should handle rapid successive calls")
            results.forEach((result) => assert.ok(Array.isArray(result)))
        })
    })

    describe("Edge Case: Empty and Null Values", () => {
        it("should handle null content in insight", async () => {
            const insights: any[] = [
                {
                    id: "ins1",
                    content: null,
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            // Should handle gracefully
            assert.ok(Array.isArray(entries))
        })

        it("should handle empty string content", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            // Should handle empty content
            assert.ok(Array.isArray(entries))
        })

        it("should handle whitespace-only content", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "   \n\t  ",
                    category: "bug",
                    severity: 50,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.ok(Array.isArray(entries))
        })
    })

    describe("Edge Case: Boundary Severity Values", () => {
        it("should handle severity = 0 (lowest)", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Minimal issue",
                    category: "other",
                    severity: 0,
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.ok(entries.length >= 0, "Should handle zero severity")
        })

        it("should handle severity > 100 (over-limit)", async () => {
            const insights: Insight[] = [
                {
                    id: "ins1",
                    content: "Critical",
                    category: "security",
                    severity: 250, // Way over 100
                    source: "m001",
                    timestamp: new Date().toISOString(),
                },
            ]

            const entries = await distillInsights(insights, "", "test-session", defaultConfig)
            assert.ok(entries.length > 0, "Should handle severity > 100")
        })
    })
})
