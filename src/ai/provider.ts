import { config } from "../utils/config";
import { createLogger } from "../utils/logger";

const log = createLogger("AIProvider");

export interface AIProvider {
    complete(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string>;
    isAvailable(): boolean;
}

export class NullProvider implements AIProvider {
    isAvailable() { return false; }
    async complete(): Promise<string> {
        throw new Error("No AI provider configured. Set AI_PROVIDER in .env");
    }
}

export class OpenAICompatibleProvider implements AIProvider {
    isAvailable() { return true; }

    async complete(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
        // Strip trailing slash to avoid double-slash in URL construction
        const baseUrl = config.aiBaseUrl.replace(/\/$/, "");

        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.aiApiKey}`,
            },
            body: JSON.stringify({
                model: config.aiModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                max_tokens: maxTokens,
                stream: false,
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "(no body)");
            throw new Error(`OpenAI-compatible API error ${res.status}: ${text}`);
        }

        const data = await res.json() as any;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw new Error(`Unexpected response structure: ${JSON.stringify(data)}`);
        }
        return content.trim();
    }
}

export class AnthropicProvider implements AIProvider {
    isAvailable() { return true; }

    async complete(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": config.aiApiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: config.aiModel,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "(no body)");
            throw new Error(`Anthropic API error ${res.status}: ${text}`);
        }

        const data = await res.json() as any;
        const content = data?.content?.[0]?.text;
        if (typeof content !== "string") {
            throw new Error(`Unexpected Anthropic response structure: ${JSON.stringify(data)}`);
        }
        return content.trim();
    }
}

/**
 * Native Google Gemini provider using the generateContent REST API.
 *
 * Set in .env:
 *   AI_PROVIDER=gemini
 *   AI_MODEL=gemini-2.0-flash        # or gemini-1.5-flash, gemini-2.0-flash-lite, etc.
 *   AI_API_KEY=<your-google-ai-studio-key>
 *
 * Get a free key at https://aistudio.google.com
 * Free tier: 15 RPM, 1 million tokens/day (as of 2026).
 */
export class GeminiProvider implements AIProvider {
    isAvailable() { return true; }

    async complete(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
        const model = config.aiModel || "gemini-2.0-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.aiApiKey}`;

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: userPrompt }],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: 0.1,
                },
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "(no body)");
            throw new Error(`Gemini API error ${res.status}: ${text}`);
        }

        const data = await res.json() as any;

        // Gemini returns: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof content !== "string") {
            // Check for prompt-blocked responses
            const blockReason = data?.candidates?.[0]?.finishReason;
            if (blockReason && blockReason !== "STOP") {
                throw new Error(`Gemini response blocked: ${blockReason}`);
            }
            throw new Error(`Unexpected Gemini response structure: ${JSON.stringify(data)}`);
        }
        return content.trim();
    }
}

export function createAIProvider(): AIProvider {
    switch (config.aiProvider) {
        case "ollama":
        case "openai":
            return new OpenAICompatibleProvider();
        case "anthropic":
            return new AnthropicProvider();
        case "gemini":
            return new GeminiProvider();
        default:
            return new NullProvider();
    }
}

export const ai = createAIProvider();

log.info(`AI provider: ${config.aiProvider}${config.aiProvider !== "none" ? ` (model: ${config.aiModel})` : ""}`);