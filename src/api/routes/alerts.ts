import { FastifyInstance } from "fastify";
import { getStmts } from "../../database/queries";
import { reloadRules } from "../../alerts/engine";
import { config } from "../../utils/config";

export function registerAlertRoutes(app: FastifyInstance): void {

    app.get("/api/alerts/rules", async () => {
        const stmts = getStmts();
        return stmts.getAllAlertRules.all();
    });

    app.post<{
        Body: {
            targetId?: string;
            ruleType: string;
            condition?: any;
            digestMode?: boolean;
            fatigueThreshold?: number;
            compositeCondition?: any;
        };
    }>("/api/alerts/rules", async (req) => {
        const { targetId, ruleType, condition, digestMode, fatigueThreshold, compositeCondition } = req.body;
        const stmts = getStmts();

        const result = stmts.insertAlertRule.run(
            targetId || null,
            ruleType,
            JSON.stringify(condition || {}),
            1,
            Date.now(),
            digestMode ? 1 : 0,
            fatigueThreshold ?? 20,
            compositeCondition ? JSON.stringify(compositeCondition) : null
        );

        reloadRules();
        return { success: true, id: Number(result.lastInsertRowid) };
    });

    app.delete<{ Params: { id: string } }>("/api/alerts/rules/:id", async (req, reply) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return reply.code(400).send({ error: "Invalid rule id" });
        const stmts = getStmts();
        stmts.deleteAlertRule.run(id);
        reloadRules();
        return { success: true };
    });

    app.patch<{ Params: { id: string }; Body: { enabled?: boolean } }>(
        "/api/alerts/rules/:id",
        async (req, reply) => {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) return reply.code(400).send({ error: "Invalid rule id" });
            const stmts = getStmts();
            if (req.body.enabled !== undefined) {
                stmts.toggleAlertRule.run(req.body.enabled ? 1 : 0, id);
                reloadRules();
            }
            return { success: true };
        }
    );

    app.get<{
        Querystring: {
            targetId?: string;
            since?: string;
            acknowledged?: string;
            limit?: string;
            offset?: string;
        };
    }>("/api/alerts/history", async (req) => {
        const stmts = getStmts();
        const { targetId, limit, offset } = req.query;
        const limitVal  = Math.min(Math.max(1, parseInt(limit  || "50")  || 50),  500);
        const offsetVal = Math.max(0, parseInt(offset || "0") || 0);
        if (targetId) {
            return stmts.getAlertHistoryByTarget.all(targetId, limitVal);
        }
        return stmts.getAlertHistory.all(limitVal, offsetVal);
    });

    app.patch<{ Params: { id: string } }>("/api/alerts/history/:id/ack", async (req, reply) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return reply.code(400).send({ error: "Invalid alert id" });
        const stmts = getStmts();
        stmts.acknowledgeAlert.run(id);
        return { success: true };
    });

    // ── Fatigue / suppression ──────────────────────────────────────────────────

    app.get("/api/alerts/rules/suppressed", async () => {
        const stmts = getStmts();
        return stmts.getSuppressedRules.all();
    });

    app.post<{ Params: { id: string } }>("/api/alerts/rules/:id/unsuppress", async (req, reply) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return reply.code(400).send({ error: "Invalid rule id" });
        const stmts = getStmts();
        stmts.unsuppressAlertRule.run(id);
        reloadRules();
        return { success: true };
    });

    // ── Webhook test ──────────────────────────────────────────────────────────
    // POST /api/alerts/test  — sends a test payload to ALERT_WEBHOOK_URL.
    // Use this to verify the URL is reachable before waiting for a real event.
    app.post("/api/alerts/test", async (_req, reply) => {
        if (!config.alertWebhookUrl) {
            return reply.code(400).send({
                success: false,
                error: "ALERT_WEBHOOK_URL is not set in environment variables",
            });
        }

        const isDiscord =
            /https?:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(
                config.alertWebhookUrl
            );

        const body = isDiscord
            ? JSON.stringify({ content: "**[SENTINEL TEST]** Webhook delivery test — alert system is working.", username: "Sentinel" })
            : JSON.stringify({ event: "test", message: "Webhook delivery test — alert system is working.", timestamp: Date.now() });

        try {
            const res = await fetch(config.alertWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            });

            const text = await res.text().catch(() => "");
            if (!res.ok) {
                return reply.code(502).send({
                    success: false,
                    error: `Webhook returned HTTP ${res.status}`,
                    body: text.slice(0, 500),
                    webhookType: isDiscord ? "discord" : "generic",
                });
            }

            return {
                success: true,
                webhookType: isDiscord ? "discord" : "generic",
                httpStatus: res.status,
            };
        } catch (err: any) {
            return reply.code(502).send({
                success: false,
                error: err.message,
                webhookType: isDiscord ? "discord" : "generic",
            });
        }
    });
}
