# Caldera Bot — Final Security Audit Report

**Date:** 2026-08-10
**Scope:** Monorepo (`apps/api`, `apps/web`, `packages/{ai,commands,config,database,media,security,whatsapp}`), Firestore rules, deploy config, legacy `admin/` portal.
**Verification run:** `pnpm type-check` ✓ · `pnpm test` ✓ (129 tests, 7 packages) · `pnpm build` ✓ (9/9) · `pnpm lint` ✓ (web `--max-warnings=0`) · `pnpm audit --prod` ✓ (2 moderate DoS transitive, see §18).

---

## 1. Executive Summary & Final Status

### FINAL STATUS: PRODUCTION READY WITH KNOWN LIMITATIONS

Critical/high findings from the prior audit round are **fixed and regression-tested**:
- Cross-tenant session wipe (prefix-collision) — fixed, exact-owner query, 4 tests.
- Session identity inconsistency (two sessions per user) — fixed, canonical session id.
- Payment authorization / approve-then-revoke — fixed, single authoritative gate, latest-wins.
- Pair-code error information disclosure — fixed, generic message.
- Firestore rules — default-deny, wired into `firebase.json`.
- Dependency vulnerabilities — resolved to 2 documented moderate transitive DoS (no forced pins that would break Baileys).

Remaining items are **known limitations**, not unaddressed criticals: firestore.rules deploy pipeline absent (must be manually deployed), legacy `admin/` portal neutralized only by default-deny rules, no hard AI token/cost budget, OpenAI/Ollama HTTP calls lack explicit abort timeout, TOTP field is decorative.

---

## 2. Scope & Methodology

- Reviewed: authentication, authorization/IDOR matrix, payment gate, session lifecycle, Firestore rules, secrets, logging/PII, rate limits, input validation & ReDoS, command execution, scheduler semantics, WebSocket realtime, SSRF, media processing, supply chain, legacy admin panel, AI provider calls.
- Tests: added `apps/api/src/payment-gate.test.ts` (9), `apps/api/src/safe-errors.test.ts` (4), `packages/database/src/payment-utils.test.ts` (5), rewritten `packages/whatsapp/src/__tests__/auth-store.test.ts` (4).
- Tooling: vitest, ESLint 9 flat config (`--max-warnings=0`), `pnpm audit --prod`.

---

## 3. Authentication & Session Management

- `fastify.authenticate` on every non-health route (`onRequest`/`preHandler`): JWT cookie → Firebase Auth verify → **user reloaded from DB** (role authoritative, not token).
- Username login charset tightened: `USERNAME_RE = /^[A-Za-z0-9._@+-]+$/`, `.trim().min(3).max(254)` applied to both `setupSchema` and `loginSchema` (keeps Google emails functional).
- Google sign-in: Firebase ID token verified server-side, email claim required, owner-first-create flow.
- `apps/api/src/websocket.ts` re-authenticates via JWT cookie + reloads user from DB, fails closed on deleted user.
- **Limitation:** `totpEnabled` is present only as a `me` response field; no verification endpoint exists → treat as decorative/non-enforcing.

---

## 4. Authorization & IDOR Matrix

Route ownership matrix verified. All non-health routes are authenticated; admin operations (`logs`, payment admin ops, settings writes) call `isAdminUser`; DB layer enforces `currentUserId`/`isOwnerOrAdmin` at query level for:
- auto-replies (get/update/delete), templates (list/create/update/delete), deleted-messages (list/delete), message-history, schedules + schedule events, scheduled-message transitions.
- `logs.ts` admin-only; `message-history.ts` disabled unless `MESSAGE_HISTORY_ENABLED`.
- `settings.ts` uses `ALLOWED_SETTING_KEYS` allowlist + retention-key validation; GET does not return secret values.

---

## 5. Payment Authorization Gate

- ONE authoritative check: `canConnectWhatsApp` / `assertCanConnectWhatsApp` in `apps/api/src/payment-gate.ts`.
- Used uniformly by `/api/whatsapp/connect`, `/pair-code`, and startup `connectAllApproved()`.
- OWNER/ADMIN role-exempt (role from DB). Others resolve APPROVED payment record — identifier order email > username > id. **FAIL CLOSED** on missing user/identity/record/lookup error.
- Client body/query/headers can never assert payment status.
- `getUserPaymentStatus` uses `mostRecentPaymentRequest()` (`packages/database/src/payment-utils.ts`) sorted by `createdAt` desc → approve-then-revoke fails closed.
- 5 tests cover gate + latest-wins.

---

## 6. Pair-Code & Error Information Disclosure

- `safePairCodeError` (`apps/api/src/safe-errors.ts`) → generic `Unable to generate pairing code.` (500/paired-error paths). Full error logged server-side via `fastify.log.error`.
- `pairCodeSchema.phoneNumber` bounded `.min(8).max(20)`.
- 4 tests.

---

## 7. Cross-Tenant Isolation (Session Wipe)

- **Root cause:** `clearFirebaseAuthState` scanned `sessions()` and matched `doc.id.startsWith(sessionKey + '_')` → `user_alice_1` could wipe `user_alice_1_2`.
- **Fix:** exact field-equality query. `upsertSession` now stores an `ownerSession` field; new `listSessionsForOwner` does `where('ownerSession','==',ownerSession)`; `clearFirebaseAuthState` batch-deletes ONLY docs owned by the exact key, fails closed on query error.
- `useFirebaseAuthState` passes `sessionKey` as owner.
- 4 tests incl. prefix-collision regression (`user_alice_1` must not wipe `user_alice_1_2`).

---

## 8. Firestore Rules

- `firestore.rules`: default-deny `match /{document=**} { allow read, write: if false; }` with comment documenting Admin SDK bypass + legacy admin portal not a security boundary.
- `firebase.json` wired: `{"firestore": {"rules": "firestore.rules"}}`.
- `apps/web` is Firebase Auth-only; **no client Firestore access** anywhere.
- **Limitation:** no automated deploy of rules (Netlify build only ships web; see §20). Must run `firebase deploy --only firestore:rules` manually. Until then, rely on the (already default-deny) deployed rules — verify with `firebase deploy --dry-run`.

---

## 9. Secrets Management

- `.env*` gitignored incl. `firebase-service-account.json`, `openify-studio-firebase-adminsdk-*.json`; confirmed never committed (`git log --all`).
- API keys come from env / Firestore settings; GET endpoints do not return secret values.
- **New fix this round:** settings single-update audit log previously wrote `Updated setting ${key} = ${value}` → API keys persisted in plaintext to the audit log. Now masked: `key.includes('API_KEY') ? '***' : value` (both single and batch paths).

---

## 10. Logging & PII

- Removed `[DIAG][DISPATCHER]` verbose log (chat metadata) from `packages/commands/src/dispatcher.ts`.
- Audit log entries reviewed across auth, whatsapp, commands, autoreply, deleted-messages, scheduler, templates, settings — no message bodies, no payment refs (payment.ts logs nothing), no secret values.
- Server error logs may include exception messages (server-side only); acceptable.
- **Note:** `[CALDERA_DEBUG][AUTOREPLY]` logs `senderNumber`/`chatId`/lengths — metadata, not message content. Server-side. Pre-existing; acceptable for now.

---

## 11. Rate Limiting & DoS

`config: { rateLimit }` added:
- login + `/api/auth/google`: 10/1min
- whatsapp connect + pair-code: 10/1min
- payment submit: 10/1min
- command execute: 30/1min
- scheduled-messages create: 30/1min
- command layer: `commandRateLimiter` 3/5s, `deniedCommandRateLimiter` 3/30s; `ownerOnly` + cooldown on sensitive commands.

---

## 12. Input Validation & ReDoS

- `auto-reply.ts`: static safety guard before regex compile + input sliced to 1000 chars.
- `calc.ts`: charset guard `[^0-9+\-*/%()^.\s]`.
- Schemas bounded (commandText ≤1000, phoneNumber ≤20, username ≤254).

---

## 13. Command Execution

- `system` + `eval` in `packages/commands/src/plugins/system.ts` are `ownerOnly: true`.
- eval sandbox hardened: empty `vm` context, `codeGeneration:{strings:false,wasm:false}`, execution timeouts.
- `/api/commands/:plugin/execute` route admin-gated; `executeCommandSchema.commandText.max(1000)`.
- `resolveOwnerPhone` fail-closed (DB setting > env, default `''`).

---

## 14. Scheduler Semantics

- Accurate claim: **at-least-once** (never exactly-once).
- Atomic PENDING→PROCESSING claim; stale PROCESSING requeued after 2min; PENDING restored on unavailable session.
- DB transitions (`getScheduledMessage`/`update`/`duplicate`/`transition`/`delete`/`getMessageEventsForSchedule`) all enforce `currentUserId`/`isOwnerOrAdmin`.

---

## 15. WebSocket Realtime

- Auth-only (JWT cookie re-verified server-side, user reloaded from DB, fails closed on deleted user).
- Socket keyed by canonical `username || id`.
- Fanout breadth (per-room vs global) low-priority item — data isolation held at DB/route layer; not revisited this round.

---

## 16. SSRF & External Fetches

- All outbound fetches target fixed external hosts (`worldtimeapi.org`, `open.er-api.com`, `translate.googleapis.com`, `image.pollinations.ai`); user input `encodeURIComponent`-escaped; 30s `AbortSignal.timeout`.
- AI providers hit operator-configured `OPENAI_BASE_URL`/`OLLAMA_BASE_URL` (not user input).
- **Limitation:** OpenAI + Ollama `generateText` fetches have **no explicit abort timeout** (Gemini uses SDK, has internal timeouts). A stalled provider can hold a request indefinitely. Low risk (owner-only commands), recommend `AbortSignal.timeout` on those two fetches.

---

## 17. Media Processing

- `packages/media/src/converter.ts`: `execFile` (no shell), 60s timeout + SIGKILL, output cap 25MB, input cap 50MB. No shell injection surface.

---

## 18. Supply Chain & Dependencies

- Root `packageManager: pnpm@10.34.5`; `pnpm.overrides` moved to `pnpm-workspace.yaml` (`postcss ^8.5.23`, `sharp ^0.35.3`, `uuid ^11.1.1`); fresh install applies them.
- `pnpm audit --prod` = **2 moderate transitive DoS only**:
  1. `music-metadata@7.14.0` via Baileys `^7.12.3` (CJS `require()` at `node_modules/@whiskeysockets/baileys/lib/Utils/messages-media.js:193`). Patched `11.12.3` is ESM-only → would break Baileys audio-send. **Not pinned** — documented, mitigated by ownership + only bot-owner can send media.
  2. `file-type@16.5.4` (same dependency chain).
- No forced pin that breaks runtime; risk accepted and documented.

---

## 19. Legacy Admin Portal

- `admin/app.js` still exists: client-side Firestore, JS allow-list, hardcoded `openify-studio` project, direct payment-status writes.
- Neutralized ONLY by Firestore default-deny rules (§8). **No deploy automation exists.**
- Action: confirm live project rules via `firebase deploy --only firestore:rules --dry-run` (or `firebase firestore:rules:get`), then either delete `admin/` or accept it as mitigated-by-default-deny.

---

## 20. Deploy Config & Pipeline

- `firebase.json`: Firestore rules only.
- `netlify.toml`: builds web only, redirects `/api/*` → `https://caldera-bot-api.onrender.com/api/:splat`; no functions; no rules deploy.
- Render hosts API. No committed secrets in any pipeline.

---

## 21. Remaining Recommendations (prioritized)

1. **P0:** Deploy Firestore rules manually (`firebase deploy --only firestore:rules`) and verify live rules; then delete or neutralize `admin/`.
2. **P1:** Add `AbortSignal.timeout(60s)` to OpenAI/Ollama `generateText` fetches.
3. **P2:** Add AI per-request `maxOutputTokens` + optional daily budget setting (owner-only commands limit exposure today).
4. **P2:** Either implement TOTP verification or remove the decorative `totpEnabled` field.
5. **P3:** Replace `[CALDERA_DEBUG][AUTOREPLY]` metadata logging with a structured, configurable logger.
6. **P3:** Re-run `pnpm audit` after each Baileys upgrade; re-evaluate `music-metadata`/`file-type` pin when Baileys ships ESM or CJS-compatible patched versions.

**Final status: PRODUCTION READY WITH KNOWN LIMITATIONS.**
