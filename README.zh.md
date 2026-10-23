# dsh-threads

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。主对话当调度员：遇到能独立完成的任务，就开一个**讨论串**——一个你能点进去接着聊的真实会话；讨论串做完后，把简短摘要回报给主对话。

> 状态：**M0 骨架**。插件能加载，并报告它能用到哪些 DSH 服务；讨论串在 M1 实现。详见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。

## 开发安装

需要 DeepSeek Harness 0.2.1-rc.2（桌面版）和 Node ≥ 22.19。

```sh
npm install
npm run check
# 完全退出 DeepSeek Harness 后：
npm run dev:install
```

## 协议

MIT
