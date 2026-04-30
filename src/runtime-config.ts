import { getDb } from "./database/connection";
import { config } from "./utils/config";
import { createLogger } from "./utils/logger";

const log = createLogger("RuntimeConfig");

// Values masked to "••••••••" in the GET /api/config response
export const SENSITIVE_KEYS = new Set([
    "DISCORD_TOKEN",
    "AI_API_KEY",
    "SUPABASE_SERVICE_KEY",
    "ALERT_WEBHOOK_URL",
    "CRITICAL_WEBHOOK_URL",
]);

// All keys that can be changed at runtime without restarting the selfbot.
// Excluded: DB_MODE, DB_PATH, LOG_LEVEL, API_PORT, API_AUTH_TOKEN, RANDOM_JITTER
export const RUNTIME_KEYS = [
    "DISCORD_TOKEN",
    "ALERT_WEBHOOK_URL",
    "CRITICAL_WEBHOOK_URL",
    "AI_PROVIDER",
    "AI_MODEL",
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_ANALYSIS_INTERVAL_MS",
    "AI_CATEGORIZATION_BATCH_SIZE",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SYNC_INTERVAL_MS",
    "BACKFILL_ENABLED",
    "BACKFILL_MAX_DAYS",
    "BACKFILL_MAX_MESSAGES_PER_CHANNEL",
    "ALERT_DIGEST_MODE",
    "ALERT_DIGEST_INTERVAL_MS",
    "ALERT_FATIGUE_THRESHOLD",
    "BRIEF_GENERATION_TIME",
    "PROFILE_POLL_INTERVAL_MS",
    "STATUS_POLL_INTERVAL_MS",
    "DAILY_SUMMARY_INTERVAL_MS",
] as const;

export type RuntimeKey = typeof RUNTIME_KEYS[number];

type ChangeCallback = (key: RuntimeKey, value: string) => void;
const changeListeners = new Map<RuntimeKey, ChangeCallback[]>();

// Maps env key names → config object props + type parsers
const KEY_MAP: Record<RuntimeKey, { prop: keyof typeof config; parse: (v: string) => any }> = {
    DISCORD_TOKEN:                    { prop: "discordToken",              parse: v => v },
    ALERT_WEBHOOK_URL:                { prop: "alertWebhookUrl",           parse: v => v },
    CRITICAL_WEBHOOK_URL:             { prop: "criticalWebhookUrl",        parse: v => v },
    AI_PROVIDER:                      { prop: "aiProvider",                parse: v => v },
    AI_MODEL:                         { prop: "aiModel",                   parse: v => v },
    AI_API_KEY:                       { prop: "aiApiKey",                  parse: v => v },
    AI_BASE_URL:                      { prop: "aiBaseUrl",                 parse: v => v },
    AI_ANALYSIS_INTERVAL_MS:          { prop: "aiAnalysisIntervalMs",      parse: v => parseInt(v, 10) },
    AI_CATEGORIZATION_BATCH_SIZE:     { prop: "aiCategorizationBatchSize", parse: v => parseInt(v, 10) },
    SUPABASE_URL:                     { prop: "supabaseUrl",               parse: v => v },
    SUPABASE_SERVICE_KEY:             { prop: "supabaseServiceKey",        parse: v => v },
    SUPABASE_SYNC_INTERVAL_MS:        { prop: "supabaseSyncIntervalMs",    parse: v => parseInt(v, 10) },
    BACKFILL_ENABLED:                 { prop: "backfillEnabled",           parse: v => v !== "false" },
    BACKFILL_MAX_DAYS:                { prop: "backfillMaxDays",           parse: v => parseInt(v, 10) },
    BACKFILL_MAX_MESSAGES_PER_CHANNEL:{ prop: "backfillMaxMsgsPerChannel", parse: v => parseInt(v, 10) },
    ALERT_DIGEST_MODE:                { prop: "alertDigestMode",           parse: v => v === "true" },
    ALERT_DIGEST_INTERVAL_MS:         { prop: "alertDigestIntervalMs",     parse: v => parseInt(v, 10) },
    ALERT_FATIGUE_THRESHOLD:          { prop: "alertFatigueThreshold",     parse: v => parseInt(v, 10) },
    BRIEF_GENERATION_TIME:            { prop: "briefGenerationTime",       parse: v => v },
    PROFILE_POLL_INTERVAL_MS:         { prop: "profilePollIntervalMs",     parse: v => parseInt(v, 10) },
    STATUS_POLL_INTERVAL_MS:          { prop: "statusPollIntervalMs",      parse: v => parseInt(v, 10) },
    DAILY_SUMMARY_INTERVAL_MS:        { prop: "dailySummaryIntervalMs",    parse: v => parseInt(v, 10) },
};

function applyToConfig(key: RuntimeKey, value: string): void {
    const entry = KEY_MAP[key];
    if (!entry) return;
    (config as any)[entry.prop] = entry.parse(value);
}

function getConfigValue(key: RuntimeKey): string {
    const entry = KEY_MAP[key];
    if (!entry) return "";
    const val = (config as any)[entry.prop];
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return String(val);
    return String(val ?? "");
}

/** Load persisted overrides from the DB and apply them on top of .env defaults. */
export function loadRuntimeConfig(): void {
    const db   = getDb();
    const rows = db.prepare("SELECT key, value FROM runtime_config").all() as { key: string; value: string }[];

    let applied = 0;
    for (const { key, value } of rows) {
        if ((RUNTIME_KEYS as readonly string[]).includes(key)) {
            applyToConfig(key as RuntimeKey, value);
            applied++;
            log.debug(`Loaded: ${key}${SENSITIVE_KEYS.has(key) ? " [sensitive]" : ` = ${value}`}`);
        }
    }

    log.info(`Runtime config loaded (${applied} override(s) from DB)`);
}

/** Returns all runtime keys with sensitive values replaced by "••••••••". */
export function getRuntimeConfigMasked(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of RUNTIME_KEYS) {
        const val = getConfigValue(key);
        result[key] = SENSITIVE_KEYS.has(key) && val ? "••••••••" : val;
    }
    return result;
}

/** Persist a new value, update the in-memory config object, and fire callbacks. */
export function setRuntimeConfig(key: RuntimeKey, value: string): void {
    const db = getDb();
    db.prepare(
        `INSERT INTO runtime_config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value, Date.now());

    applyToConfig(key, value);
    log.info(`Config updated: ${key}${SENSITIVE_KEYS.has(key) ? " [sensitive]" : ` = ${value}`}`);

    const listeners = changeListeners.get(key) ?? [];
    for (const cb of listeners) {
        try { cb(key, value); }
        catch (err: any) { log.error(`onChange callback error for ${key}: ${err.message}`); }
    }
}

/** Register a side-effect callback that fires whenever a key is changed via setRuntimeConfig. */
export function onConfigChange(key: RuntimeKey, cb: ChangeCallback): void {
    const arr = changeListeners.get(key) ?? [];
    arr.push(cb);
    changeListeners.set(key, arr);
}
