import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || "super-secret-key";

app.post("/v1/chat/completions", async (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const ollamaRes = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await ollamaRes.json();
    res.status(ollamaRes.status).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/v1/models", async (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ollamaRes = await fetch("http://localhost:11434/v1/models");
  const data = await ollamaRes.json();
  res.json(data);
});

app.listen(3000, () => {
  console.log("Ollama proxy running on port 3000");
});