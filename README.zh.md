# dsh-threads

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。主对话当调度员：遇到能独立完成的任务，就开一个**讨论串**——一个你能点进去接着聊的真实会话；讨论串做完后，把简短摘要回报给主对话。

> 状态：**M3b**。项目（一个文件夹 + 一个主对话）、从项目开讨论串、回报主对话、`thread_reply`、`/thread <任务>` 已可用；讨论串可以在右侧面板打开、直接对话、标记已解决（M2b）；回报、简报和"N 条回复"在对话里显示成讨论串卡片，模型自己的建议以勾选卡片放在输入框上方（M2c）。最多 3 个讨论串在项目文件夹里并行，回报一起送达（M3a）；会改文件的讨论串在自己的 git worktree 和分支里工作（M3b）。详见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。

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
