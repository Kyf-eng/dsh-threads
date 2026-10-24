# dsh-threads — project notes for Claude Code

DeepSeek Harness (DSH) plugin: the main conversation dispatches work into real thread sessions and gets short summaries back. Design and verified DSH APIs: `docs/IMPLEMENTATION.md` (read it before changing behaviour). Original idea and Git process: `docs/Plan.md`.

## Commands
- `npm run check` — typecheck (host + client), vitest, build. Run before every commit.
- `npm run build` — `tsdown` writes `dist/index.js` (host, ESM) and `dist/client.js` (browser, CJS wrapped in `window.__ModuleLoader__.load`).
- `npm run dev:install` — link this checkout into the Desktop profile. DSH must be fully quit first.

## Conventions
- Developed against DSH `0.2.1-rc.2`; `engines.dsh` (`>=0.2.1-rc.2 <0.3.0`) decides compatibility. `@deepseek-ai/*` packages are devDependencies pinned to that version for types and tests; runtime imports must also be listed in `peerDependencies`, with the same range as `engines.dsh`, so DSH resolves them to its own copies. Never bundle them (`deps.neverBundle`).
- `.npmrc` sets `legacy-peer-deps=true`; DSH packages pin many exact peers we do not want installed.
- `dist/` is committed: GitHub installs go through pnpm 11, which blocks `prepare` scripts. Rebuild and commit `dist/` with every source change.
- Optional host services are read with `optional(ctx, name)` (src/probe.ts); a `ctx.<service>` getter throws when the service is not injected.
- Tool names start with `thread_` (global tool names must be unique; Agent Team is enabled in the Desktop profile).
- Browser ↔ host calls go through one Fetch route, `POST /api/dsh-threads` with `{ method, payload }` (src/rpc.ts), registered inside `ctx.inject(['connection'], …)`. Do not use `connection.rpc.handle`: it needs the caller's `ctx.webServer`, which profile bundles cannot inject on Desktop.
- Session ids follow DSH's own shape: `session-${randomUUID()}`; project ids are `project-${randomUUID()}`.
- Threads belong to projects: only a project's main conversation gets the dispatcher tools (src/roles.ts, src/install.ts). Keep it that way; it mirrors Claude's projects.
- New stored fields need zod defaults in src/storage.ts so records written by earlier versions still read.
- Browser half: the slot catalog (types, scopes, props of every slot) is `CLIENT_SLOT_API` in the app's `dsh-cordis-client-runner/lib/client.js`. Use the host's shared `@deepseek-ai/dsh-client-ui-primitives` (external) and `--dsw-alias-*` theme variables; inject CSS through src/client/styles.ts. Only register slot keys we own.
- Messages put into a session inbox use `createUserMessage` with `source.kind = 'dsh-threads'`. `ctx.sessionController.prompt` always stamps `kind: 'user'`, so dispatcher-sent tasks go through `resolveAgent(id)` → `agent.followup(...)`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one topic per branch, squash merge.

## Local notes and approval testing
- Machine-specific notes (how this checkout's DSH is set up, local profile fixes) live in `docs/LOCAL.md`, which is git-ignored. Read it when present; never move its contents into tracked files.
- A modified DSH install can auto-approve regardless of the session's mode. Verify approval inheritance only on an isolated stock DSH (`DSH_HOME=~/dsh-clean npx @deepseek-ai/dsh@0.2.1-rc.2 web`); see docs/IMPLEMENTATION.md §六 item 8.
