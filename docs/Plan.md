# DSH 多讨论串调度插件：开发说明与 Git 规划

Oct 23, 2026 · @fky

## 想法

做一个 DeepSeek Harness（DSH）插件：一个常驻的主对话当“调度员”，你只跟它提需求。它自己判断要不要开讨论串，每个讨论串是一个真实的子会话，你可以点进去接着聊；做完后把摘要回报给主对话。

- **参考对象**：Claude “一个主对话 + 自动开讨论串”的体验。
- **核心差异**：Claude 那边跑在云端，这个插件全部跑在你自己电脑上，讨论串可以直接读写本地项目。
- **暂定名**：`dsh-threads`。2026-10-23 复查：npm 上的 `dsh-threads` 已被别人占名（"Threads channel bridge for dsh bots - name reserved"），所以 GitHub 仓库仍叫 `dsh-threads`，npm 改用作用域包 `@<npm 用户名>/dsh-threads`。
- **详细实施计划**：见 [IMPLEMENTATION.md](IMPLEMENTATION.md)，里面的接口都已对照 DSH 0.2.1-rc.2 桌面版安装包里的源码确认。

&#91;embedded content: 工作方式 · 主对话与讨论串\]

讨论串做完后通过会话收件箱把摘要投回主对话；你也可以随时点进任何一个讨论串直接对话。

## 现状调研

没找到和这个体验一样的 DSH 插件，最接近的几个都是“预先定义”或“手动发起”，不是主对话自己按需开线程。

| 插件 | 做什么 | 和本项目的差别 |
| --- | --- | --- |
| [dsh-agent-team-gui](https://github.com/toolclub/dsh-agent-team-gui/releases) | 预先配置多模型“小队”，串行或并行协作，能看每个成员的子会话 | 团队要先定义好再选；不是按需开讨论串 |
| [dsh-crew](https://glama.ai/mcp/servers/ZSeven-W/dsh-crew) | 让 Claude Code、Codex 等外部工具把活派给 DSH 的 agent | 方向相反，调度者在 DSH 外面 |
| dsh-sidechain | `/side` 开侧边会话、`/btw` 问一次性旁支问题 | 你手动开，不是主对话自己调度 |
| dsh\_workflow | 可保存、可恢复的多 agent 工作流 | 预定义流程，偏任务编排而非对话 |
| [dsh-projects](https://github.com/Alexis-fish/dsh-projects) | 项目 + 多会话 + git worktree 隔离 | 可借鉴它的 worktree 做法 |

动手前在 GitHub 的 `dsh-plugin` 话题和 dsh-market 里，用 thread、dispatch、orchestrator、讨论串、调度 等关键词再搜一遍，这个生态更新非常快。

## 可依赖的 DSH 底层能力

做这件事需要的底层能力 DSH 基本都有，插件主要负责调度逻辑和界面。下面是从社区文档和其他插件里看到的，**写代码前要对照官方文档和源码确认真实接口**。

- **开子会话**：原生支持 spawn 和 fork。spawn 的子会话只看到交给它的任务；fork 能看到父会话已完成的轮次。可继续的子会话在有持久描述符时可以恢复（[子代理指南](https://dev.to/ahab_indieseek/deepseek-harness-subagents-jobs-and-workflows-guide-fh0)）。
- **完成后通知主对话**：[dsh-loop](https://socket.dev/npm/package/dsh-loop/overview/0.1.0) 用 `Agent.send` 往会话收件箱投递 `wakeup: true` 的消息。会话空闲时作为下一轮输入，运行中时在下一步收到。讨论串回报可以照抄这套机制。
- **插件形态**：Cordis 插件 + `package.json` 里的 `dsh.bundle` 声明 + `cordis.patch.yml` 挂载。分主机端（工具、`ctx.webServer` 路由）和浏览器端（网页界面插槽、设置页）两半。
- **安装方式**：`dsh plugin --profile <profile> add` 支持 npm 包名、GitHub 仓库、本地路径和 `.tgz`。桌面版的 profile 叫 `desktop`（不是 `web`），命令行在 `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`，执行前要完全退出 DSH。
- **类型声明**：App 安装包里的 `@deepseek-ai/*` 不带 `.d.ts`；类型从 npm 上同版本的包拿（devDependencies 精确锁 `0.2.1-rc.2`）。
- **审批相关的测试要用干净的 DSH**：有些社区插件会改动 DSH 安装包里的官方文件（例如让审批自动通过、关闭沙箱），这种改动和会话选哪个模式无关。插件照常在自己的桌面版上开发，"审批继承"这一项验收用隔离的官方 DSH 做，做法见 IMPLEMENTATION.md。
- **官方开发文档**：仓库 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的开发指南和架构文档，发布规范在文档站的 /develop/basic/publish。

## 设计要点与注意事项

最关键的一条是：讨论串只回摘要，细节留在讨论串里，否则主对话的上下文很快会被撑爆。

1. **主对话只收摘要**。回报只含结论、改动了哪些文件、待你决定的事，外加讨论串链接。
2. **调度靠提示词，不一定可靠**。dsh-agent-team-gui 的作者指出 DSH 暂时没有强制模型调用某个工具的机制。所以要加一个手动入口（如 `/thread` 命令），模型没开串时你也能自己开。
3. **改代码的讨论串要隔离**。多个讨论串同时改同一个文件会冲突，给它们各自开 git worktree；只读、做调研的讨论串不用。
4. **电脑得开着，状态要能恢复**。讨论串列表和状态写到磁盘，重启 DSH 或电脑睡眠后能接着用。
5. **限制并发和花费**。设一个同时运行上限（先定 3 个），面板里显示每个讨论串用了多少 token。
6. **权限不能悄悄变大**。讨论串继承主对话的审批模式，不能因为是后台跑就自动变成全自动。插件代码本身和 DSH 跑在同一进程里，不受工具审批保护。
7. **DSH 还在开发者预览**。接口会有破坏性变更：锁定开发用的 DSH 版本，在 `package.json` 用 `engines.dsh` 声明兼容范围，每次 DSH 升级后重跑测试。
8. **密钥不进代码**。API key 走 DSH 自己的凭据存储，插件不碰。

## MVP 范围与里程碑

第一版只要跑通“开一个讨论串、做完回报主对话”这一个闭环。

**MVP 要做的**

- 主对话工具：`thread_open`（标题 + 任务）、`thread_status`（查进度）、`thread_reply`（给某个讨论串追加指令）。
- 讨论串完成后，自动往主对话发一条摘要。
- 侧栏讨论串列表：标题、状态，点击跳到对应会话。
- 一段系统提示：告诉主对话它是调度员，简单的事自己做，复杂或可并行的事开讨论串。
- 手动入口 `/thread <任务>`。

**MVP 先不做**：worktree 隔离、多个讨论串并行、token 统计、手机端适配。

**里程碑**（每一步完成的标准写在后面）

1. **M0 调研与骨架**：读官方开发文档，确认 spawn/fork 和 `Agent.send` 的真实接口。完成标准：一个空插件能装进 DSH、工具出现在工具列表里。
2. **M1 单个讨论串闭环**：完成标准：对主对话说一个任务，它开出讨论串，讨论串做完后主对话收到摘要。
3. **M2 面板与追加指令**：完成标准：侧栏能看到所有讨论串和状态，`thread_reply` 可用，重启 DSH 后列表还在。
4. **M3 并行与隔离**：完成标准：可同时跑多个讨论串、有并发上限，改代码的讨论串在独立 worktree 里。
5. **M4 发布 v0.1.0**：完成标准：中英 README、GitHub Release 附 `.tgz`、加上 `dsh-plugin` 话题、向 awesome-dsh-plugin 提交收录。

## Git 与 GitHub 规划

原则：`main` 分支永远能装、能跑；所有改动走分支 + PR，哪怕只有你一个人。

### 建仓库

- **名字**：`dsh-threads`，公开仓库，MIT 协议。
- **Topics**：`dsh-plugin`、`deepseek-harness`、`dsh`。官方 README 要求插件仓库加 `dsh-plugin` 话题，大家靠它发现插件。
- **初始文件**：`README.md`、`README.zh.md`、`LICENSE`、`CHANGELOG.md`、`.gitignore`、`package.json`、`tsconfig.json`、`cordis.patch.yml`、`src/`、`tests/`，再加一个给 Claude Code 看的 `CLAUDE.md`（写清项目约定）。
- **`.gitignore` 至少包含**：`node_modules/`、构建产物目录、`*.tgz`、`.env`、`.DS_Store`。
- **打开安全开关**：仓库设置里的 secret scanning 和 push protection，防止误提交 API key。

### 分支与提交

- **分支命名**：`feat/thread-open`、`fix/summary-too-long`、`docs/readme`，一个分支只做一件事。
- **提交信息**用 Conventional Commits：`feat:`、`fix:`、`docs:`、`test:`、`chore:`，以后生成更新日志很方便。
- **合并方式**：PR 用 squash merge，合并后删分支。
- **保护 `main`**：禁止直接推送，要求 CI 通过才能合并。

日常流程：

1. `git switch main && git pull`
2. `git switch -c feat/xxx`，写代码、小步提交
3. `git push -u origin feat/xxx`，开 PR
4. 等 CI 变绿，自己看一遍改动，squash merge
5. 删掉分支，回到第 1 步

### CI（GitHub Actions）

- **每次 push 和 PR**：Node 22.19 和 24 两个版本各跑一遍安装、类型检查、测试、构建（DSH 要求 Node ^22.19 或 ≥ 24）。
- **打 tag 时**：自动构建、`pnpm pack` 出 `.tgz`，附到 GitHub Release 上。

### 版本与发布

- **版本号**：语义化版本。先用 `v0.1.0-rc.1` 这样的预发布版，稳定了再发 `v0.1.0`。
- **发布渠道**：先只用 GitHub Release，安装命令 `dsh plugin --profile desktop add github:<你的用户名>/dsh-threads#v0.1.0`。稳定后再发 npm。
- **构建产物怎么处理**：从 GitHub 直接安装时需要编译好的代码。已确认 DSH 用 pnpm 11 安装插件，它会拦截 `prepare` 脚本（要用户手动放行），所以**把 `dist/` 提交进仓库**，不写 `prepare`。

### 用 Issues 管理进度

- 每个里程碑建一个 GitHub Milestone（M0–M4），任务拆成 Issue 挂在下面。
- 标签：`bug`、`enhancement`、`dsh-compat`（DSH 升级导致的问题）。
- 让 Claude Code 按 Issue 开分支和 PR，你负责看改动和合并。

## 参考链接

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- [DeepSeek Harness 子代理、任务与工作流指南](https://dev.to/ahab_indieseek/deepseek-harness-subagents-jobs-and-workflows-guide-fh0)
- [dsh-loop](https://socket.dev/npm/package/dsh-loop/overview/0.1.0)
- [dsh-agent-team-gui](https://github.com/toolclub/dsh-agent-team-gui/releases)
- [dsh-projects](https://github.com/Alexis-fish/dsh-projects)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
