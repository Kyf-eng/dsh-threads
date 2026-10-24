# Contributing

Thanks for helping. The project's conventions live in [CLAUDE.md](CLAUDE.md) and the design,
with every DeepSeek Harness interface it relies on, in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).
Read the design before changing behaviour.

## Setup

Node ≥ 22.19 and DeepSeek Harness 0.2.x.

```sh
npm install
npm run check        # typecheck (host + browser), tests, build
npm run dev:install  # link this checkout into the Desktop profile; quit DSH completely first
```

`dist/` is committed (GitHub installs cannot run build scripts): rebuild it and commit it with
every source change. CI fails when it is out of date.

## Changes

- One topic per branch and pull request; Conventional Commits (`feat:`, `fix:`, `docs:`,
  `test:`, `ci:`, `chore:`); squash merge.
- New stored fields need zod defaults in `src/storage.ts`, so records from earlier versions
  still read (`tests/storage.test.ts`).
- Text the host half writes goes through `src/messages.ts` (Chinese and English); the browser's
  text lives in `src/client/locale.ts`.
- Tests: `npm test`. Changes to dispatching or the thread UI also need a run in a real project:
  give the main conversation several tasks without saying "thread", send a new request while
  threads run, and check that reports come back and the sidebar and cards show the right states.
- Anything about approvals must be checked on a stock DeepSeek Harness
  (`DSH_HOME=~/dsh-clean npx @deepseek-ai/dsh@<version> web`), not on a modified install; see
  docs/IMPLEMENTATION.md §六 item 8.

## Releases

See "Release" in [CLAUDE.md](CLAUDE.md): a release PR, then a `v<version>` tag on `main`;
`.github/workflows/release.yml` does the rest.

---

中文：约定见 [CLAUDE.md](CLAUDE.md)，设计和依赖的 DSH 接口见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。改代码后跑 `npm run check` 并把 `dist/` 一起提交；新存储字段要有 zod 默认值；宿主端文案写进 `src/messages.ts`；改调度或界面要在真实项目里跑一遍；和审批有关的改动要在官方原版 DSH 上验证。
