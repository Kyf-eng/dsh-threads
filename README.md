# dsh-threads

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. Your main conversation acts as a dispatcher: when a task is self-contained, it opens a **thread** — a real session you can click into and keep talking to — and when the thread finishes, a short summary comes back to the main conversation.

> Status: **M0 skeleton**. The plugin loads and reports what it can reach; threads arrive in M1. See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

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
