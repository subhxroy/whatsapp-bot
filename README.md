# Caldera Bot — Private Self-Hosted WhatsApp Bot

> A production-quality WhatsApp multi-device automation bot with a **₹150 one-time UPI activation** monetization flow and per-user WhatsApp sessions, styled with the **Caldera Design System**.

---

## 🎨 Caldera Design Aesthetics

- **Limestone Canvas (`#e2e2df`)**: Warm paper-like surface canvas.
- **Ember Saturation (`#fc5000`)**: Vivid orange primary action buttons and metric cards.
- **Plasma Violet (`#524ae9`)**: Signature halftone dot pattern hero cards.
- **Sulfur Highlights (`#f5f28e`)**: Soft yellow category badges.
- **Obsidian Type (`#070607`)**: Industrial condensed display headings (**Bebas Neue**) paired with **DM Sans** body type.
- **Triple-Radius System**: 40px cards, 800px pills, 100px inputs.
- **Shadowless Flat Design**: Contrast-based surface hierarchy with zero drop shadows.

---

## ⚡ Tech Stack & Architecture

- **Protocol**: Baileys multi-device protocol encapsulated inside `packages/whatsapp`; Baileys session keys are encrypted at rest with Node.js `crypto` **AES-256-GCM** in Firestore.
- **Multi-Tenant Sessions**: `apps/api/src/session-manager.ts` runs one `WhatsAppClient` per dashboard user (auto-connected on boot for approved users), each wired to its own `CommandDispatcher`.
- **Backend API**: Fastify REST & WebSocket gateway (`apps/api`) with JWT auth cookies, direct Firestore audit logging, and a 5s background birthday/scheduled-message scheduler.
- **Frontend Dashboard**: Next.js 15 App Router (`apps/web`) with Tailwind CSS — WhatsApp connection, commands, auto-replies, scheduled messages, AI, media, logs, security, settings.
- **Database**: **Cloud Firestore** (`firebase-admin`).
- **Commands**: 43 plugins across `general / utility / media / ai / admin` categories, including `.sticker`, `.vv` (view-once reveal), `.ai`, `.birthday`/`.schedule`, group controls, and fun/utility commands.
- **Monetization**: ₹150 one-time UPI activation → UTR submission → admin approval (dashboard Admin tab or standalone `admin/` portal) → WhatsApp access unlocked.
- **Static Surfaces**: `landing/` (marketing) and `admin/` (standalone master admin portal), both Netlify-hosted.
- **Deployment**: Netlify (dashboard + static sites) / Render (API + bot runtime) / optional `docker-compose.yml` self-hosting.

> Full file-by-file architecture reference: see [`brain.md`](brain.md).

---

## 🚀 Local Quickstart

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Set FIREBASE_SERVICE_ACCOUNT_PATH (or place firebase-service-account.json in repo root),
   # SESSION_ENCRYPTION_KEY, JWT_SECRET, BOT_OWNER_NUMBER, and optionally the SMTP_* vars.
   ```

3. **Bootstrap Firestore**:
   ```bash
   pnpm --filter @private-md-bot/api firebase:setup
   ```

4. **Build Monorepo**:
   ```bash
   pnpm build
   ```

5. **Start Full Stack (API + WhatsApp bot + dashboard)**:
   ```bash
   node server.js
   ```
   - **Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **API Gateway**: [http://localhost:4000](http://localhost:4000)
   - API-only mode (standalone backend): `API_ONLY=true node server.js`

---

## 🐙 Push to GitHub

To push your repository to GitHub:

```bash
git init
git add .
git commit -m "feat: Caldera design system, Netlify, Render, and GitHub ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

## 🌐 Netlify Deployment (Web Dashboard + Static Surfaces)

This repository includes a pre-configured [`netlify.toml`](netlify.toml) file.

1. Connect your GitHub repository to [Netlify](https://www.netlify.com/).
2. Build command: `pnpm --filter @private-md-bot/web build` · Publish directory: `apps/web/.next`.
3. `/api/*` requests are redirected to the Render backend (`caldera-bot-api.onrender.com`).
4. Deploy `landing/` and `admin/` as separate static sites (e.g. `caldera-bot.netlify.app` and `admin-caldera-bot.netlify.app`).

---

## ☁️ Render Deployment (API & Web)

This repository includes a pre-configured [`render.yaml`](render.yaml) Blueprint file.

1. Connect your repository to [Render.com](https://render.com/).
2. Click **New +** → **Blueprint**.
3. Select this repository. Render will automatically provision:
   - `private-whatsapp-bot-api` (Fastify API backend, auto-generates `SESSION_ENCRYPTION_KEY` / `JWT_SECRET`)
   - `private-whatsapp-bot-web` (Next.js Dashboard)

---

## 🐳 Self-Hosted Docker (Optional)

`docker-compose.yml` provisions `redis`, `api`, `web`, and a `caddy` reverse proxy. Requires `firebase-service-account.json` in the repo root and the same env keys as local development.
