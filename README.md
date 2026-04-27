<p align="center">
  <img src="demo.gif" alt="Selfbot collecting data" width="720">
</p>

<table align="center">
  <tr>
    <td>
      <img src="https://raw.githubusercontent.com/Privex-chat/sentinel/main/assets/logo.png" alt="Sentinel Logo" width="120" style="vertical-align: middle;">
    </td>
    <td>
      <h1>🔧 sentinel-selfbot</h1>
      <h3><em>The data collection engine for the Sentinel ecosystem</em></h3>
      <p>Connects to Discord as a user account, logs behavioral data on tracked targets, and exposes everything through a local REST/SSE API.</p>
    </td>
  </tr>
</table>

<p align="center">
  <a href="https://github.com/Privex-chat/sentinel-selfbot"><img src="https://img.shields.io/github/stars/Privex-chat/sentinel-selfbot?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/Privex-chat/sentinel-selfbot"><img src="https://img.shields.io/github/forks/Privex-chat/sentinel-selfbot?style=social" alt="GitHub forks"></a>
  <br>
  <a href="https://polyformproject.org/licenses/noncommercial/1.0.0"><img src="https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue" alt="License"></a>
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Project Status">
  <img src="https://img.shields.io/badge/self‑hosted-yes-green" alt="Self-Hosted">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node version">
</p>

---

## 🧠 What It Does

Add a user ID. From that moment, the selfbot starts recording everything it can observe:

- 🟢 **Online / offline presence** — and on which device
- 🎮 **Games & activities** — what they play, for how long
- 🎵 **Spotify listening** — tracks, albums, artists
- 🎙️ **Voice channel movements** — joins, leaves, who they’re with
- 💬 **Messages** — sent, edited, deleted
- 👻 **Ghost typing** — started typing but never sent
- 🖼️ **Profile changes** — username, avatar, bio, connected accounts
- 📥 **Server joins & leaves**

All data is stored in a local SQLite database. Optional Supabase sync keeps a cloud mirror for backup or cross‑device access.

---

## 🚀 Quick Start

```bash
git clone https://github.com/Privex-chat/sentinel-selfbot.git
cd sentinel-selfbot
npm install
cp .env.example .env
# Edit .env — set DISCORD_TOKEN and API_AUTH_TOKEN
npm run build && npm start
```

Then any Sentinel interface (plugin, web panel) can connect to `http://localhost:48923`.

Full setup guide: [docs/selfbot.md](https://github.com/Privex-chat/sentinel/blob/main/docs/selfbot.md)

---

## 🏗️ Project Structure

```
src/
├── gateway/        Discord WebSocket connection
├── collectors/     Event handlers (presence, messages, voice, etc.)
├── analyzers/      Statistical analysis modules
├── api/            HTTP API server and routes
├── pollers/        Periodic REST API fetchers
├── alerts/         Alert rule engine
├── database/       SQLite schema, queries, migrations, Supabase sync
└── utils/          Config, logger, rate limiter, snowflake utils
```

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | — | User account token (not a bot token) |
| `API_AUTH_TOKEN` | Yes | — | Bearer token for API authentication |
| `API_PORT` | No | `48923` | Port the API listens on |
| `DB_PATH` | No | `./data/sentinel.db` | SQLite database file path |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `DB_MODE` | No | `local` | `local`, `local+cloud`, or `cloud` |
| `SUPABASE_URL` | Conditional | — | Required when `DB_MODE` is not `local` |
| `SUPABASE_SERVICE_KEY` | Conditional | — | Required when `DB_MODE` is not `local` |
| `RANDOM_JITTER` | No | `false` | Randomise polling intervals and gateway fingerprint |

---

## 🌐 API

The selfbot exposes a Fastify HTTP server with endpoints for targets, events, analytics, insights, messages, profiles, and alerts.  
Full reference: [docs/api.md](https://github.com/Privex-chat/sentinel/blob/main/docs/api.md)

```bash
# Check status
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:48923/api/status

# Add a target
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"123456789012345678"}' \
  http://localhost:48923/api/targets
```

---

## 🚢 Deployment

| Platform | Notes |
|----------|-------|
| Local / VPS | Run with `npm start` or use PM2 for persistence |
| Docker | `Dockerfile` included |
| **Railway** | **One‑click deploy** – [![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/sentinel-selfbot?referralCode=zpvHsG&utm_medium=integration&utm_source=template&utm_campaign=generic) |
| Fly.io | `fly.toml` included. Use `DB_MODE=cloud` with Supabase |

---

## ⚠️ Important Notes

- **Selfbot usage** — Running automated code on a regular Discord user account violates Discord's Terms of Service. Use a dedicated account. Understand the risks.
- **Only track people you have a legitimate reason to monitor.** This tool is built for personal and research use.

---

## 🔗 Related

- [sentinel-plugin](https://github.com/Privex-chat/sentinel-plugin) — Vencord plugin UI
- [sentinel-web](https://github.com/Privex-chat/sentinel-web) — Browser dashboard
- [sentinel-proxy](https://github.com/Privex-chat/sentinel-proxy) — Windows proxy for remote selfbot

---

## 📜 License

[PolyForm Noncommercial License 1.0.0](LICENSE)