/**
 * /dream command - Memory Consolidation
 */

import type { Logger } from "../logger"
import type { PluginConfig } from "../config"
import type { SessionState, WithParts } from "../state"
import { sendIgnoredMessage } from "../ui/notification"
import { getCurrentParams } from "../token-utils"

export interface DreamCommandContext {
    client: any
    state: SessionState
    config: PluginConfig
    logger: Logger
    sessionId: string
    messages: WithParts[]
}

export async function handleDreamCommand(
    ctx: DreamCommandContext,
    _args: string[],
): Promise<void> {
    const { client, state, logger, sessionId, messages } = ctx

    try {
        logger.info("[Dream] Sending prompt", { sessionId })

        const prompt = buildPrompt(messages.length)

        await client.session.prompt({
            path: { id: sessionId },
            body: {
                parts: [{ type: "text", text: prompt }],
            },
        })

        logger.info("[Dream] Prompt sent successfully")
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error("[Dream] Failed", { error: msg })
        await sendIgnoredMessage(
            client,
            sessionId,
            "Failed: " + msg,
            getCurrentParams(state, messages, logger),
            logger,
        )
    }
}

function buildPrompt(count: number): string {
    return [
        "Dream consolidation - " + count + " messages.",
        "",
        "Scan chat: find Goal, Fails, Fix.",
        "",
        "Format as:",
        "## [Memory: Task]",
        "- Goal: [1 line]",
        "- Fails: [bad] -> [why]",
        "- Fix: [win]",
        "- Anti-Loop: NEVER [wrong] again.",
        "",
        "Save to ~/.config/opencode/AGENTS.md:",
        "1. mkdir -p ~/.config/opencode",
        '2. echo "## Memory" >> ~/.config/opencode/AGENTS.md',
        "3. Append formatted text",
        "",
        'Reply: "Dream done."',
    ].join("\n")
}
