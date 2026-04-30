import { FastifyInstance } from "fastify";
import { getRuntimeConfigMasked, setRuntimeConfig, RUNTIME_KEYS } from "../../runtime-config";
import { createLogger } from "../../utils/logger";

const log = createLogger("ConfigAPI");

export function registerConfigRoutes(app: FastifyInstance): void {
    // GET /api/config — all runtime keys, sensitive values masked
    app.get("/api/config", async (_req, reply) => {
        return reply.send(getRuntimeConfigMasked());
    });

    // PATCH /api/config — update a single key in real time
    app.patch<{ Body: { key: string; value: string } }>("/api/config", {
        schema: {
            body: {
                type: "object",
                required: ["key", "value"],
                properties: {
                    key:   { type: "string" },
                    value: { type: "string" },
                },
            },
        },
    }, async (req, reply) => {
        const { key, value } = req.body;

        if (!(RUNTIME_KEYS as readonly string[]).includes(key)) {
            return reply.code(400).send({ error: `Unknown or immutable config key: ${key}` });
        }

        try {
            setRuntimeConfig(key as any, value);
            return reply.send({ success: true });
        } catch (err: any) {
            log.error(`Config update error for ${key}: ${err.message}`);
            return reply.code(500).send({ error: err.message });
        }
    });
}
