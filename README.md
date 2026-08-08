# Caldera — Private Self-Hosted WhatsApp Bot

> Forge fire on warm limestone. A production-quality, single-user WhatsApp multi-device automation bot styled with the **Caldera Design System**.

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

- **Protocol**: Baileys multi-device protocol encapsulated inside `packages/whatsapp`.
- **Backend API**: Fastify REST & WebSocket gateway (`apps/api`) with JWT auth cookies and BullMQ workers.
- **Frontend Dashboard**: Next.js 15 App Router (`apps/web`) with Tailwind CSS.
- **Database & Security**: SQLite / PostgreSQL with Prisma ORM and Node.js native `crypto` AES-256-GCM session key encryption at rest.

---

## 🚀 Local Quickstart

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Initialize Database**:
   ```bash
   pnpm db:push
   ```

3. **Build Monorepo**:
   ```bash
   pnpm build
   ```

4. **Start Development Mode**:
   ```bash
   pnpm dev
   ```
   - **Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **API Gateway**: [http://localhost:4000](http://localhost:4000)

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

## 🌐 Netlify Deployment (Web Dashboard)

This repository includes a pre-configured [`netlify.toml`](file:///c:/Users/Subhankar%20Roy/Downloads/wp_bot/netlify.toml) file.

1. Connect your GitHub repository to [Netlify](https://www.netlify.com/).
2. Set Build Command: `pnpm --filter @private-md-bot/web build`
3. Set Publish Directory: `apps/web/.next`
4. Netlify will automatically detect `@netlify/plugin-nextjs`.

---

## ☁️ Render Deployment (API & Web)

This repository includes a pre-configured [`render.yaml`](file:///c:/Users/Subhankar%20Roy/Downloads/wp_bot/render.yaml) Blueprint file.

1. Connect your repository to [Render.com](https://render.com/).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Select this repository. Render will automatically provision:
   - `private-whatsapp-bot-api` (Fastify API backend)
   - `private-whatsapp-bot-web` (Next.js Dashboard)
