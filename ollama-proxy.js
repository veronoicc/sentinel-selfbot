import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();

// Limit JSON body size (adjust as needed)
app.use(express.json({ limit: "10mb" }));

const API_KEY = process.env.API_KEY || "super-secret-key";
const OLLAMA_BASE = "http://localhost:11434";

// Constant-time comparison for the API key
function isAuthorized(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return false;
  const expected = `Bearer ${API_KEY}`;
  if (authHeader.length !== expected.length) return false;
  // Using timingSafeEqual from Node.js crypto
  try {
    return crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// Middleware to protect all routes
app.use((req, res, next) => {
  if (!isAuthorized(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Helper function to forward requests to Ollama
async function proxyRequest(req, res, ollamaPath) {
  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}${ollamaPath}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        // Do NOT forward the auth header to Ollama
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });

    // Copy status and headers from Ollama
    const headers = {};
    for (const [key, value] of ollamaRes.headers.entries()) {
      // Avoid forwarding hop-by-hop headers if any
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    res.status(ollamaRes.status).set(headers);

    // Stream the response body (works for both streaming and non-streaming)
    ollamaRes.body.pipe(res);
  } catch (err) {
    // Log the real error internally, send a generic message to the client
    console.error(`Proxy error for ${ollamaPath}:`, err);
    res.status(502).json({ error: "Bad gateway" });
  }
}

app.post("/v1/chat/completions", (req, res) => {
  proxyRequest(req, res, "/v1/chat/completions");
});

app.get("/v1/models", (req, res) => {
  proxyRequest(req, res, "/v1/models");
});

// Optional health-check endpoint (no auth required if you prefer)
app.get("/health", (_, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ollama proxy running on port ${PORT}`);
});