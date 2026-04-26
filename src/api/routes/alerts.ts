import { FastifyInstance } from "fastify";
import { getStmts } from "../../database/queries";
import { reloadRules } from "../../alerts/engine";

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

        // Use extended insert that handles new columns
        const result = require("../../database/connection").getDb().prepare(
            `INSERT INTO alert_rules
             (target_id, rule_type, condition, enabled, created_at, digest_mode, fatigue_threshold, composite_condition)
             VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
        ).run(
            targetId || null,
            ruleType,
            JSON.stringify(condition || {}),
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
        if (targetId) {
            return stmts.getAlertHistoryByTarget.all(targetId, parseInt(limit || "50"));
        }
        return stmts.getAlertHistory.all(parseInt(limit || "50"), parseInt(offset || "0"));
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
}
