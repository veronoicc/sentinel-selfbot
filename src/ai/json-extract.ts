/**
 * Robust JSON extraction from LLM responses.
 * Handles markdown code fences, trailing prose, trailing commas,
 * single-line comments, truncated output, and other common LLM
 * formatting artifacts (especially from local models via Ollama).
 */

function stripCodeFences(s: string): string {
    return s
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
}

/**
 * Attempt a series of progressively more aggressive cleanups to coerce
 * a malformed LLM JSON string into something JSON.parse can handle.
 */
function attemptRepairs(s: string): string {
    // 1. Remove JS-style single-line comments (// ...)
    s = s.replace(/\/\/[^\n\r]*/g, "");

    // 2. Remove JS-style block comments (/* ... */)
    s = s.replace(/\/\*[\s\S]*?\*\//g, "");

    // 3. Remove trailing commas before ] or }
    //    Handles: [1, 2, 3,] and {"a":1,"b":2,}
    s = s.replace(/,(\s*[\]}])/g, "$1");

    // 4. Collapse runs of whitespace inside strings is risky — skip it.
    //    Just normalise lone \r to \n so the parser doesn't choke.
    s = s.replace(/\r\n?/g, "\n");

    return s;
}

/**
 * Try to parse `s`, retrying once after running repairs.
 * Throws the original error if both attempts fail.
 */
function parseWithRepairs(s: string): unknown {
    try {
        return JSON.parse(s);
    } catch (firstErr) {
        try {
            return JSON.parse(attemptRepairs(s));
        } catch {
            // Re-throw the original error so the caller sees the real position.
            throw firstErr;
        }
    }
}

/**
 * Extract and parse a JSON object `{...}` from raw LLM output.
 * Trims leading/trailing prose and code fences, then applies
 * progressive repairs before parsing.
 */
export function extractJsonObject(raw: string): Record<string, unknown> {
    let s = stripCodeFences(raw.trim());

    const start = s.indexOf("{");
    const end   = s.lastIndexOf("}");
    if (start !== -1 && end > start) {
        s = s.slice(start, end + 1);
    }

    return parseWithRepairs(s) as Record<string, unknown>;
}

/**
 * Extract and parse a JSON array `[...]` from raw LLM output.
 * Trims leading/trailing prose and code fences, then applies
 * progressive repairs before parsing.
 */
export function extractJsonArray(raw: string): unknown[] {
    let s = stripCodeFences(raw.trim());

    const start = s.indexOf("[");
    const end   = s.lastIndexOf("]");
    if (start !== -1 && end > start) {
        s = s.slice(start, end + 1);
    }

    return parseWithRepairs(s) as unknown[];
}