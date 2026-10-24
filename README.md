# dsh-threads

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. Your main conversation acts as a dispatcher: when a task is self-contained, it opens a **thread** — a real session you can click into and keep talking to — and when the thread finishes, a short summary comes back to the main conversation.

> Status: **M3c**. Projects (a folder plus one main conversation), threads opened from a project, reports back to it, `thread_reply` and `/thread <task>` work. Threads open in the right sidebar with their own composer and can be marked resolved (M2b). Reports, briefs and "N replies" show as thread cards in the conversation, and the model's own suggestions wait in a checklist card above the composer (M2c). Up to 3 threads run in parallel in the project folder; their reports arrive together (M3a). Threads that change files work in their own git worktree and branch (M3b). Threads stay out of the session list and the UI follows Claude's thread design (M3c). See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

## Development install

Requires DeepSeek Harness 0.2.1-rc.2 (Desktop) and Node ≥ 22.19.

```sh
npm install
npm run check
# quit DeepSeek Harness completely, then:
npm run dev:install
```

## License

MIT
