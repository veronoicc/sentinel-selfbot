import { FastifyInstance, FastifyRequest } from "fastify";
import { getStmts } from "../../database/queries";
import { getDb } from "../../database/connection";

type EventCallback = (event: any) => void;
const sseClients: Set<{ send: EventCallback; targetFilter?: string }> = new Set();

export function pushSSEEvent(event: any): void {
    for (const client of sseClients) {
        if (client.targetFilter && event.target_id !== client.targetFilter) continue;
        try {
            client.send(event);
        } catch {
            sseClients.delete(client);
        }
    }
}

export function registerEventRoutes(app: FastifyInstance): void {
    app.get<{
        Querystring: {
            targetId?: string;
            type?: string;
            since?: string;
            until?: string;
            limit?: string;
            offset?: string;
            guildId?: string;
            channelId?: string;
            search?: string;
        };
    }>("/api/events", async (req) => {
        const db = getDb();
        const { targetId, type, since, until, limit, offset, guildId, channelId, search } = req.query;

        const limitVal  = Math.min(Math.max(1, parseInt(limit  || "100") || 100), 1000);
        const offsetVal = Math.max(0, parseInt(offset || "0") || 0);

        let sql = "SELECT * FROM events WHERE 1=1";
        const params: any[] = [];

        if (targetId)  { sql += " AND target_id = ?";   params.push(targetId); }
        if (type)      { sql += " AND event_type = ?";  params.push(type); }
        if (since) {
            const sinceVal = parseInt(since);
            if (!isNaN(sinceVal)) { sql += " AND timestamp >= ?"; params.push(sinceVal); }
        }
        if (until) {
            const untilVal = parseInt(until);
            if (!isNaN(untilVal)) { sql += " AND timestamp <= ?"; params.push(untilVal); }
        }
        if (guildId)   { sql += " AND guild_id = ?";    params.push(guildId); }
        if (channelId) { sql += " AND channel_id = ?";  params.push(channelId); }
        if (search)    {
            sql += " AND (data LIKE ? OR event_type LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += " ORDER BY timestamp DESC";
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limitVal, offsetVal);

        return db.prepare(sql).all(...params);
    });

    app.get<{ Querystring: { targetId?: string } }>("/api/events/stream", async (req, reply) => {
        const targetFilter = req.query.targetId;

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",        // ← disables nginx buffering on Railway
            "Access-Control-Allow-Origin": "*",
            // removed: "Connection: keep-alive"  ← invalid in HTTP/2, causes issues
        });

        reply.raw.write("data: {\"type\":\"connected\"}\n\n");

        const client = {
            targetFilter,
            send: (event: any) => {
                reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
            },
        };

        sseClients.add(client);

        // Send a keepalive comment every 25 s so Railway/nginx proxies don't
        // time out the idle connection and silently drop the live-event stream.
        const keepalive = setInterval(() => {
            try {
                reply.raw.write(":ping\n\n");
            } catch {
                clearInterval(keepalive);
                sseClients.delete(client);
            }
        }, 25_000);

        req.raw.on("close", () => {
            clearInterval(keepalive);
            sseClients.delete(client);
        });
    });
}
