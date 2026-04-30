import { FastifyInstance } from "fastify";
import { analyzeSleepSchedule } from "../../analyzers/sleep-schedule";
import { detectRoutine } from "../../analyzers/routine-detector";
import { predictAvailability } from "../../analyzers/availability";
import { detectAnomalies } from "../../analyzers/anomaly-detector";
import { detectCorrelations } from "../../analyzers/correlation-detector";

export function registerInsightRoutes(app: FastifyInstance): void {
    app.get<{ Params: { userId: string } }>("/api/targets/:userId/insights", async (req) => {
        const { userId } = req.params;
        const sleep = analyzeSleepSchedule(userId);
        const routine = detectRoutine(userId);
        const availability = predictAvailability(userId);
        const anomalies = detectAnomalies(userId);
        return { sleep, routine: routine.summary, availability, anomalies: anomalies.slice(0, 10) };
    });

    app.get<{ Params: { userId: string }; Querystring: { days?: string } }>("/api/targets/:userId/insights/sleep", async (req) => {
        const days = Math.min(Math.max(1, parseInt(req.query.days || "14") || 14), 365);
        return analyzeSleepSchedule(req.params.userId, days);
    });

    app.get<{ Params: { userId: string }; Querystring: { weeks?: string } }>("/api/targets/:userId/insights/routine", async (req) => {
        const weeks = Math.min(Math.max(1, parseInt(req.query.weeks || "4") || 4), 52);
        return detectRoutine(req.params.userId, weeks);
    });

    app.get<{ Params: { userId: string }; Querystring: { weeks?: string } }>("/api/targets/:userId/insights/availability", async (req) => {
        const weeks = Math.min(Math.max(1, parseInt(req.query.weeks || "4") || 4), 52);
        return predictAvailability(req.params.userId, weeks);
    });

    app.get<{ Params: { userId: string }; Querystring: { days?: string } }>(
        "/api/targets/:userId/insights/anomalies",
        async (req) => {
            const days = Math.min(Math.max(1, parseInt(req.query.days || "7") || 7), 90);
            return detectAnomalies(req.params.userId, days);
        }
    );

    app.get<{
        Params: { userId: string };
        Querystring: { days?: string; window_hours?: string };
    }>(
        "/api/targets/:userId/insights/correlations",
        async (req) => {
            const { userId } = req.params;
            const days = Math.min(Math.max(1, parseInt(req.query.days || "30") || 30), 365);
            const windowHours = Math.min(Math.max(0.1, parseFloat(req.query.window_hours || "0.5") || 0.5), 24);
            const windowMs = Math.round(windowHours * 3_600_000);
            return detectCorrelations(userId, days, windowMs);
        }
    );
}
