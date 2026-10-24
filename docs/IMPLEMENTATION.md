# dsh-threads 详细实施计划

## Context

docs/Plan.md 定了方向：在 DeepSeek Harness（DSH）里做一个插件——主对话当"调度员"，按需开讨论串，每个讨论串是一个真实的子会话，做完把摘要回报主对话。
但 Plan.md 里的接口都写着"写代码前要对照官方源码确认"，参考对象（Claude 的"主对话 + 讨论串"）也没讲清楚原理。
本计划做了三件事：
1. 讲清 Claude 这套机制的原理，并逐条映射到 DSH。
2. 用 DSH 0.2.1-rc.2 桌面版安装包里的源码、一个同类第三方插件（cq-guojia/dsh-task-dispatch-table）确认真实接口。
3. 把 M0–M2 拆到文件级。

已定的三件事：
- **包名**：仓库名叫 `dsh-threads`，npm 用作用域包。`dsh-threads` 在 npm 上已被别人占名。包名暂用 `@fky/dsh-threads`，M0 时确认你的 npm 用户名，改名只动 `package.json` 和 `cordis.patch.yml` 两处。
- **开串权限**：照 Claude 的做法——你点名的任务直接开；模型自己想到的只出提议。
- **批准后的执行范围**：把本计划存为 `docs/IMPLEMENTATION.md`，然后完成 M0。

---

## 一、参考对象的原理：Claude Code 桌面版的"主对话 + 讨论串"

（来源：我当前运行环境里实际拿到的工具和规则。）

**两层委派**
- **子代理**（`Agent` 工具）：本任务的一部分，比如大范围搜索、并行读文件、复核。用户点不进去，结果在本轮内回到主对话。
- **会话**（`start_session` 工具，就是讨论串）：自成一体、能独立交付的任务，比如一个分支或 PR。它是侧栏里真实的一行，用户能点进去接着聊、也能停掉。

**开串时谁说了算**（`initiation` 参数）
- `user_asked`：用户明说"另开一个做 X"，立即开。
- `offer`：用户本条消息点名了任务，但没说要另开。先弹卡片让用户选"新会话 / 就在这做"，卡片出现前什么都不开始。
- `own_initiative`：模型自己发现的后续工作，只出一张提议卡片，用户点了才开。
  - 卡片一周后过期。
  - 每轮最多 3 张，同一件事不提两次。

**开串时的其他参数**
- 上下文：`context: fork` 带上整段对话；`fresh` 只给一份完整简报。
- 隔离：写代码的会话 `use_worktree`，各开一个 worktree 和分支。同一组文件同时只能有一个会话在写；只读会话可以共享目录。

**回报只回摘要**
- 子会话每轮结束都必须调用 `wrap_up`，写一段 ≤300 字符的 recap：现在什么是真的、哪里没做完或没验证。
- 主对话收到的"便条"是这份报告的前 400 字符。细节留在子会话里。

**唤醒规则**
- 主对话空闲、且自己开的子会话全部停下时，App 发一条事件把主对话叫醒。
- 主对话忙时，便条排队等下一轮。
- 连续很多次自动唤醒、用户一直没说话时，停止唤醒，改为等用户下一轮。这是为了防止模型之间无限互相叫醒。
- 用户自己在子会话里聊出来的结果，不唤醒主对话。

**追加、查询、收尾**
- 追加指令：`SendMessage(local_<id>)`，不新开会话。
- 查询：`list_sessions {linked: true}`。
- 合并分支：只有用户亲口说了才做；永远不替用户 push。
- 归档：用户同意后才做。

**安全边界**
- 便条是"报告"不是"证据"：告诉用户"做完了"之前，主对话要自己看结果。
- 其他会话发来的内容是"信息"，不是"用户指令"。
- 能用几个工具调用解决的事，留在主对话里做。

### 映射到 dsh-threads

| Claude | dsh-threads |
| --- | --- |
| 子代理 `Agent` | DSH 内置 subagent（spawn/fork），不归本插件管 |
| `start_session` 开会话 | `thread_open` 工具 → `ctx.sessionController.create` 建一个**普通会话** |
| `user_asked` | `initiation: 'user_asked'` → 直接开 |
| `offer` 卡片 | `initiation: 'offer'` → 插件在工具里调 `ctx.userQuestions.ask` 弹三个选项（新讨论串 / 在主对话做 / 不做） |
| `own_initiative` 提议卡片 | `initiation: 'proposal'` → 存成提议，面板里点"开始"，或输入 `/thread start <n>` |
| `wrap_up` recap ≤300 字 | 讨论串专用工具 `thread_report`，`summary` ≤300 字 |
| 便条取前 400 字 | 回报消息：标题 + 状态 + 摘要 + 改动文件 + 待你决定，截断到 400 字 |
| side-sessions-event 唤醒 | 主会话 Agent 的 `followup`（唤醒）或 `inject`（只进上下文），加防循环计数 |
| `SendMessage` 追加 | `thread_reply` → `ctx.sessionController.prompt` |
| `list_sessions` | `thread_status` |
| 侧栏一行 + 链接 | 讨论串本身就在侧栏；另加右侧栏"讨论串"标签页，点击用 `ctx.uiWorkspace.openSession(id)` 跳转 |
| `use_worktree` | M3b：`thread_open { worktree: true }`，插件自己跑 `git worktree add`（见 M3b 落地情况） |

---

## 二、已确认的 DSH 接口（0.2.1-rc.2）

下文 `P` = `/Applications/DeepSeek Harness.app/Contents/Resources/app/dsh/node_modules/@deepseek-ai`。

**类型声明**
- 安装包里没有 `.d.ts`，但 npm 上的 `@deepseek-ai/*@0.2.1-rc.2` 带类型。
- 做法：用 devDependencies 精确锁版本拿类型，运行时用宿主自带的副本。

### 插件骨架
- **模块**：`export const name / inject / Config / apply(ctx, config)`。
  - `Config` 用 `@deepseek-ai/schemastery` 的 `z`（参考 `P/dsh-tool-ralph/lib/index.js`）。
  - `inject` 里列的服务都是必需的；没列的服务，`ctx.xxx` 一读就抛错。可选服务用 `ctx.get('x')` 读。
- **`package.json`**
  - `"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web", "inject": [...] } }`
  - exports：`"."`、`"./client"`、`"./cordis.patch.yml"`、`"./locale/*.json"`、`"./package.json"`。插件页靠后两个显示标题和图标。
  - 版本兼容：写了 `engines.dsh` 就只看它；用 `">=0.2.1-rc.2 <0.3.0"`。
- **`cordis.patch.yml`**
  - 写成 `- insert: [{ id, name: '<本包名>', config }]`。
  - 必须有一行的 `name` 是本包名，浏览器那一半才会被发现。
- **安装**
  - CLI 位置：`/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`，不在 PATH 上。
  - 命令：`dsh plugin --profile desktop add link:<路径>`。先**完全退出** DSH 再执行。
  - 装好后自动加入 profile 的 bundles。
  - 从 GitHub 安装时，pnpm 11 会拦截 `prepare` 脚本。所以**把 `dist/` 提交进仓库**，不写 `prepare`。
  - 改了代码要重启 DSH，或者在插件页关掉再打开。
- **工具**
  - 定义用 `defineTool`（`@deepseek-ai/dsh-tools`）。它会校验参数；裸的 `tools.register` 不校验。
  - `execute(args, exec)` 里能拿到 `exec.agent`（`id` 就是 session id，另有 `followup/steer/inject/whenIdle`）、`exec.callId`、`exec.signal`。
  - 每个会话单独装工具的写法（参考 `P/dsh-experimental-tool-agent-team/lib/index.js:227-553`）：
    - 先装一遍 `ctx.agents.list()`，再监听 `ctx.on('agent/created')`。
    - 用 `agent.ctx.tools.register(...)` 和 `agent.ctx.systemPrompt.section(...)` 注册。
    - 在 `agent/disposed` 和插件卸载时自己清理。
  - 工具名要加 `thread_` 前缀：启用了 Agent Team（实验性）的 profile 里已有不少全局工具，重名会抛错。
- **斜杠命令**（参考 `P/dsh-command-goal/lib/index.js:174`）
  - 注册：`ctx.commands.register({ definitionId, name, description, input: { hint }, handler })`。
  - `handler` 拿到 `{ agent, rawInput, signal }`，返回 `{ kind: 'success' | 'error', text }`。
- **系统提示**
  - 全局：`ctx.systemPrompt.section({ name, order, text })`。
  - 只给某个会话：用 `agent.ctx.systemPrompt.section(...)`。
- **持久化**
  - `ctx.storageDomain.open(defineDomain({ name: 'dsh_threads', version: 1, layout: 'single', tables: {...} }))`。
  - 文件落在 `~/.dsh/storages/dsh_threads.json`。
  - 名字只能是小写字母、数字和下划线。
- **浏览器 ↔ 宿主**
  - 浏览器调宿主（M0 实机确认）：宿主端在 `ctx.inject(['connection'], …)` 里调 `connection.fetch.register({ path: '/api/dsh-threads', methods: ['POST'], requestBody: 'buffered', fetch })`。浏览器端用相对路径 `fetch('api/dsh-threads', { method: 'POST', body: JSON.stringify({ method, payload }) })`。
  - **不能用 `connection.rpc.handle`**：它要通过调用方自己的 `ctx.webServer` 注册路由，而桌面版的第三方插件看不到 `webServer`。
  - 宿主往浏览器推自定义事件不行（事件是白名单）。会话标题、运行状态、token 浏览器端本来就有，实时可读。

### 讨论串 = 普通会话
- **建会话**：`ctx.sessionController.create({ workspaceId, sessionId, agentPreset })` → `{ sessionId }`。
  - 和用户在界面上点"新会话"走同一条路：自动挂 preset、归入工作区、出现在侧栏。
  - Agent 归会话控制器所有，**插件重载时讨论串不会被销毁**。
  - 不支持写父会话关联，所以"属于哪个主会话"记在插件自己的表里。
- **发任务和追加**：`ctx.sessionController.prompt({ sessionId, content, requestId }, source)`，内部会走 `followup`。
- **拿 Agent**：`ctx.sessionController.resolveAgent(id)` → `{ agent } | { error }`。冷会话会自动恢复，所以重启后也能用。
- **主会话所在的工作区**：`ctx.workspaceRegistry.list().find(w => w.sessionIds.includes(mainId))`。
- **改标题**：`ctx.sessionTitle.rename(session, title)`。
- **继承审批模式**（对应 Plan.md 第 6 条）
  - 新会话默认被钉成**用户默认** preset，不是主会话当前的 preset。
  - 所以建好后要执行 `ctx.permissionPresets.set(thread.session, ctx.permissionPresets.current(main.session))`。
- **判断完成**
  - 全局监听 `ctx.on('agent/status', ({ agent, status }) => …)`，只看讨论串 id 变成 `idle`。
  - 不能用 `turn/end`：它只代表一轮结束，开了 `/goal` 还会自动续跑。
- **读最终回复**
  - 发任务前记下 `agent.session.seq`；完成后取 `agent.session.snapshotEvents(start)`，交给 `finalAssistantOutput(events)`（`@deepseek-ai/dsh-subagent` 导出）。
  - 结束原因：`foldConsumedWork(events).end?.data.reason.kind`（`@deepseek-ai/dsh-agent` 导出）。
- **唤醒主会话**（照抄 `P/dsh-subagent/lib/index.js:2048` notifySettlement）
  - 消息用 `createUserMessage({ content, source: { kind: 'dsh-threads', form: 'notice', summary } })` 建，来自 `@deepseek-ai/dsh-llm`。
  - 发送：`followup`（唤醒）或 `inject`（只进上下文）。`form: 'notice'` 在聊天界面里显示成紧凑提示。
- **token**：`ctx.sessionProjections.stateOf(session, 'tokenUsage').totals`。
- **弹选择题**（`offer` 用）
  - `ctx.userQuestions.ask({ questions: [{ id, question, header, options }], agent: exec.agent, signal: exec.signal, wait: { callId: exec.callId } })`。
  - 不走 approval 服务：approval 的结果受部署的权限模式影响（full-access 或被改过的安装会直接放行），而开串确认要的是用户每次亲自选择。
- **worktree**（M3）
  - `ctx.worktrees.create(agent, { name })` 建在 `<仓库根>/.agents/worktrees/<name>`，并自动切换工作目录。
  - **没有删除接口**，未提交的文件不会带过去。
  - **桌面版默认没装**：它来自 `@deepseek-ai/dsh-experimental-tool-worktree` 这个 bundle，desktop profile 的 bundles 里没有它。所以 M3b 不用它，自己跑 git。
  - 切工作目录用 `ctx.workingDirectory.set(agent, path)`（`dsh-working-directory`）：会记一条 `working-directory/change` 事件，并给会话塞一条"工作目录变了"的提示。

**为什么不用官方子代理（`ctx.subagents.startActivation`）**
- 它的好处：白送"标题栏子代理树"和自动回报。
- 它的问题：
  - 讨论串只能从主会话标题栏进，不在侧栏；
  - 用户给讨论串发消息时，主会话的 Agent 必须活着；
  - 审批被钉成 `never`，改代码的讨论串一遇到审批就失败；
  - 最多 8 个。

  这些和 Plan.md 要的"真实子会话、点进去接着聊"不符。

### ⚠️ 审批相关的测试要用干净的 DSH
- 有些社区插件会直接改 DSH 安装包里的官方文件，例如让 `dsh-user-approval` 的 `decide()` 恒返回"允许"、关闭沙箱。这种改动和会话选哪个模式、哪个 profile 都无关。
- 做法：
  - 开串、回报、唤醒、面板照常在自己的桌面版上开发和测试；日常测试新开会话时选标准模式，测到的调度提示更接近普通用户的环境。
  - "讨论串继承审批模式、不偷偷提权"这一项验收，在一套**隔离的官方 DSH** 上做：用 npm 上的 `@deepseek-ai/dsh@0.2.1-rc.2`，配一个单独的 `DSH_HOME`。它不读 `~/.dsh`，也不碰 App 安装包（命令见第六节第 8 条）。
  - 插件自己的开串确认用 `userQuestions`，不依赖 approval。

---

## 三、架构

```
主会话 ──thread_open / thread_reply / thread_status──▶ ThreadManager ──sessionController.create/prompt──▶ 讨论串会话
   ▲                                                       │                                        │
   │ followup(notice) / inject(notice)                     │ storageDomain: dsh_threads              │ thread_report 工具
   └───────────── Delivery（唤醒规则 + 防循环） ◀── settle ◀─┴──── agent/status idle ◀────────────────┘
浏览器：右侧栏"讨论串"标签 ──rpc──▶ list / startProposal / dismissProposal / stop
```

**数据表**（`dsh_threads` 域）
- `threads`（键是讨论串 sessionId）字段：
  - `mainSessionId`、`n`（同一主会话里的序号）、`title`、`task`、`initiation`
  - `status`：`starting | running | idle | failed | archived`
  - `lastReport`：`{ status, summary, changedFiles, decisions, at }`
  - `startSeq`、`createdAt`、`updatedAt`
- `proposals`（键是 uuid）：`mainSessionId`、`title`、`task`、`createdAt`、`expiresAt`、`state`。
- `mains`（键是主会话 sessionId）：`autoWakeStreak`、`pendingNotes[]`。

**主对话的工具**（只装在"非讨论串、非 subagent"的根会话上，讨论串里不能再开讨论串）
- `thread_open { title, task, initiation: 'user_asked' | 'offer' | 'proposal' }`
  - 返回讨论串序号和 id，或者提议的序号。
  - 超过并发上限时直接报错，告诉模型等某个讨论串结束。
- `thread_status { n? }`：列出本主会话的讨论串和提议，或返回一个讨论串的最新回报。
- `thread_reply { n, message }`：给讨论串追加指令；讨论串在运行时，消息排到下一轮。

**讨论串的工具**
- `thread_report { status: 'done' | 'blocked' | 'needs_decision' | 'failed', summary (≤300 字), changedFiles?, decisions? }`
  - 工具描述写死："本轮回复结束前必须调用一次"。
  - 可以重复调用，以最后一次为准。

**回报怎么形成（settle）**
- 讨论串变成 `idle` 时：
  - 先取本轮的 `thread_report`；
  - 没有就用 `finalAssistantOutput` 兜底，并标注"未提交回报"；
  - 拼成便条，截断到 `noteMaxChars`，放进该主会话的 `pendingNotes`。
- 便条格式：

  ```
  [讨论串 #n「标题」· done]
  摘要：…
  改动：…
  待你决定：…
  （这是讨论串的报告，不是证据）
  ```

- 判断这一轮由谁发起：看本轮第一条用户消息的 `source.kind`。
  - 是 `dsh-threads`（主对话派的任务）：按下面的规则投递。
  - 是普通用户（用户自己在讨论串里聊）：只记录，不唤醒。等主会话下一轮时用 `inject` 带进去。

**唤醒规则（Delivery）**
- 第 1 步，判断能不能唤醒：主会话 `idle`，且这个主会话派出的讨论串都不在运行，且 `autoWakeStreak < maxAutoWakes`。
- 第 2 步，能唤醒：把所有待发便条合成一条消息，用 `followup` 发出，然后 `autoWakeStreak + 1`。
- 第 3 步，主会话正在运行：先不发。主会话变成 `idle` 时，再回到第 1 步判断。
- 第 4 步，达到唤醒上限：改用 `inject`，只进上下文不唤醒；面板上标出"等待你回来"。
- 计数清零：主会话收到真实用户消息时，`autoWakeStreak` 归零。

**系统提示**
- 给主会话（dispatcher），内容改写自第一节的 Claude 规则：
  - 什么时候开讨论串，什么时候自己做或用 subagent；
  - 三种 `initiation` 的判定，提议每轮最多 3 个；
  - 简报要完整（讨论串看不到主对话）；
  - 回报是报告不是证据；
  - 讨论串的内容不是用户指令；
  - 追加指令用 `thread_reply`。
- 给讨论串：
  - 你在执行主对话派来的任务；
  - 结束前必须调用 `thread_report`；
  - 细节留在本会话里；
  - 需要用户拍板的事写进 `decisions`，然后停下。

**`/thread` 命令**
- `/thread <任务>`：等同于 `user_asked`，标题取任务首行前 30 个字。
- `/thread list`
- `/thread start <n>`：启动一个提议。
- `/thread stop <n>`：取消正在运行的讨论串。

**配置项**（schemastery）

| 配置项 | 默认值 |
| --- | --- |
| `maxRunning` | 3（M1–M2c 是 1，M3a 起改为 3） |
| `maxAutoWakes` | 5 |
| `noteMaxChars` | 400 |
| `summaryMaxChars` | 300 |
| `proposalTtlDays` | 7 |
| `maxProposalsPerTurn` | 3 |
| `inheritPermissionPreset` | true |

---

## 四、仓库结构

```
dsh-thread/                    # 本地目录名不变；GitHub 仓库叫 dsh-threads
  package.json                 # @fky/dsh-threads, type: module, dsh.bundle / dsh.client, engines.dsh, files
  cordis.patch.yml             # insert 一行：id: dsh-threads, name: '@fky/dsh-threads', config: {...}
  tsconfig.json  tsconfig.client.json  tsdown.config.ts   # 宿主端 ESM；浏览器端 CJS + __ModuleLoader__ 包装
  src/
    index.ts                   # name / inject / Config / apply：组装下面各模块
    config.ts  types.ts
    store.ts                   # ThreadStore 接口 + 内存实现（测试用）
    storage.ts                 # 用 storageDomain 实现 ThreadStore：threads / mains 两张表（M2 加 proposals）
    host.ts                    # 把 DSH 服务（sessionController、agents、sessionTitle、permissionPresets…）适配成 ThreadHost
    install.ts                 # agent/created：按会话类型装主对话工具和提示，或讨论串工具和提示
    manager.ts                 # open / onInbox / onIdle / recordReport / flush / describe（M2 加 reply / stop / startProposal）
    report.ts                  # 便条拼装、截断、finalAssistantOutput 兜底
    delivery.ts                # 唤醒规则 + 防循环（纯函数）
    prompts.ts                 # 主对话和讨论串的系统提示
    tools/{thread-open,thread-status,thread-report}.ts   # M2 加 thread-reply
    command.ts                 # /thread
    services.ts  dsh-types.ts  source.ts   # 可选服务读取、类型声明加载、消息来源类型
    rpc.ts                     # POST /api/dsh-threads {method,payload}：list / startProposal / dismissProposal / stop
    client/index.tsx  client/ThreadsTab.tsx  client/locale.ts
  locale/en.json  locale/zh.json   # { meta: { title, description } }
  tests/                       # vitest：store、delivery 规则、report、状态机，ctx 用假对象
  docs/Plan.md  docs/IMPLEMENTATION.md
  CLAUDE.md  README.md  README.zh.md  LICENSE  CHANGELOG.md  .gitignore
```

**依赖**
- devDependencies，精确锁 `0.2.1-rc.2`：
  - DSH 包：`@deepseek-ai/{cordis,dsh-tools,dsh-llm,dsh-agent,dsh-subagent,dsh-storage-domain,dsh-commands,dsh-api-session-controller}`
  - 校验库：`@deepseek-ai/schemastery@3.18.x`
  - 构建和测试：`typescript`、`tsdown`、`vitest`、`react@18.3.1`、`@types/react@18`
- 运行时：全部用宿主自带的副本，打包时标成 external，不打进 `dist/`。

---

## 五、里程碑（文件级）

### M0 骨架与接口验证（本次批准后完成）
1. 把本计划存为 `docs/IMPLEMENTATION.md`，在 `docs/Plan.md` 里修正四处：
   - `--profile web` 改成 `desktop`；
   - 写明 npm 名字被占；
   - 写明安装包不带 `.d.ts`；
   - 写明审批相关的测试要用干净的 DSH。
2. 在本地执行 `git init`，分支为 `main`，写好 `.gitignore`。**`dist/` 不忽略。**
   - 建 GitHub 远程仓库、首次 push 之前，先问你。
3. 写 `package.json`、两个 tsconfig、`tsdown.config.ts`、`cordis.patch.yml`、`locale/*.json`、`CLAUDE.md`（项目约定）。
4. `src/index.ts` 注册一个占位工具 `thread_status`，固定返回 `"dsh-threads ok"`；`src/client/index.tsx` 注册一个空的右侧栏"讨论串"标签页。
5. **接口验证（spike）**，每项写明结论和退路：
   - (a) 用 `link:` 装上的插件，运行时能不能 import 宿主的 `@deepseek-ai/dsh-llm`、`dsh-subagent`、`dsh-tools`、`dsh-storage-domain`。
     - 背景：profile 设置了 `autoInstallPeers: false` 和 `nodeLinker: hoisted`。
     - 退路：改成 dependencies 并精确锁版本。
   - (b) 第三方插件能不能 `inject` 到 `sessionController`；`create` 和 `prompt` 能不能接受自定义 `source.kind`。
     - 退路：改用 `ctx.agents.create({ sessionId, meta: { cwd, agentPreset, parentSession } })`，不传 `parentAgent`。
   - (c) 浏览器端的包装格式能不能加载，右侧栏标签页能不能出现。
   - (d) 浏览器 ↔ 宿主 RPC 能不能用（结论：用 `connection.fetch.register`，不用 `rpc.handle`）。
   - (e) `sessionController` 建的会话会不会触发 `agent/created`，从而能按会话单独装工具。
6. 构建脚本：`npm run build / typecheck / test`，再加一个 `scripts/dev-install.sh`，执行 `dsh plugin --profile desktop add link:$PWD`，并提示先退出 DSH。

**完成标准**
- 插件页里显示 dsh-threads 的标题和图标。
- 新会话的工具列表里有 `thread_status`。
- 右侧栏有"讨论串"标签。
- 接口验证 (a)–(e) 都有结论，写进 `docs/IMPLEMENTATION.md`。

#### M0 接口验证结论（2026-10-23）

"代码确认"= 读了 DSH 源码；"实机"= 在桌面版里跑过。

| 项 | 结论 | 依据 | 状态 |
| --- | --- | --- | --- |
| (a) 运行时 import 宿主的 `@deepseek-ai/*` | 可以。`link:` 装的目录走"按 peer 查找"：本包 `peerDependencies` 里列出的名字用宿主那份，其他名字才用本地 `node_modules`。所以运行时要 import 的包**必须同时写进 peerDependencies**（现在是 cordis、dsh-llm、dsh-tools、schemastery），打包时一律不打进去。 | `dsh-app-boot/README.md` "Linked directories" 一条 | **实机通过**：插件加载，`defineTool`、`createUserMessage` 都能用 |
| (b) `sessionController` 建会话、发任务 | 建会话用 `ctx.sessionController.create({ workspaceId, sessionId: 'session-<uuid>' })`，返回 `agentPreset: 'standard'`。**发任务不能用 `ctx.sessionController.prompt`**：这个对外接口把 `source.kind` 写死成 `'user'`。改成 `resolveAgent(id)` 拿到 Agent，再 `agent.followup(createUserMessage({ source: { kind: 'dsh-threads', form: 'notice', summary } }))`。`summary` 最长 120 字（`boundContextSummary`）。来源类型通过给 `@deepseek-ai/dsh-llm` 的 `MessageSourceMap` 加声明来扩展（`src/source.ts`）。 | `dsh-api-session-controller/lib/index.js:3218`；`dsh-llm` 的 `message.d.ts` | **实机通过**：侧栏出现新会话 "dsh-threads probe"（改名生效），任务显示成一行提示"收到执行请求"，模型回复 OK。注意提示行显示的是通用文案，不是我们的 `summary`，M1 再看要不要换 `form`。 |
| (c) 浏览器端打包格式 | tsdown 输出 CJS，加 banner/footer 包成 `window.__ModuleLoader__.load({ id, factory })`。产物和官方 `lib/client.js` 同构，react 和 `@deepseek-ai/*` 都不打进去。 | `dist/client.js` 头尾；对照 `dsh-client-ui-goal/lib/client.js` | **实机通过**：右侧栏引导页出现入口，标签页能渲染，并拿到当前会话 id。入口显示英文 "Threads"，因为 Electron 的 `navigator.language` 是 en-US；M2 改用 `ctx.locale` |
| (d) 浏览器 ↔ 宿主 RPC | `connection.rpc.handle` **在桌面版用不了**：它通过调用方的 `ctx.webServer` 注册，第三方插件 inject 不到 `webServer`，回调不执行，浏览器拿到 HTTP 405。改用 `connection.fetch.register`，路径 `/api/dsh-threads`，只接受 POST，`{ method, payload }` 由 `dispatchRpc` 分发；浏览器端用相对路径 `fetch('api/dsh-threads')`。桌面版的 `dsh-app://app/*` 会带 cookie 转发给宿主。 | `dsh-client-connection/lib/index.js:723-745, 816-870`；`app/lib/main.js:12455` | **实机通过**：标签页里 `host RPC: {"ok":true,…,"pings":1}` |
| (e) 新会话触发 `agent/created` | 会触发。用户新建的会话和 `sessionController.create` 建的会话，`source` 都是 `'startup'`；重启后恢复的旧会话是 `'resume'`。 | `thread_status` 的 `agentCreated.recent` | **实机通过** |

**M0 实机测试时踩到的坑：DSH 实验性检查器会把宿主整个搞崩**
- 现象：装上插件后宿主崩溃，报错 `inspector: source state exceeds the source-frame byte limit`（dsh-experimental-inspector，`lib/index.js:996`）。
- 原因：检查器先把插件树快照裁到 `maxSourceFrameBytes − 4KB`，写入时又按"全部状态 + 4KB ≤ 上限"再检查一遍，落进夹缝就抛错，没人接住，宿主退出。插件多的 profile 插件树本来就大，新插件多出的几个节点就可能把它推进夹缝。和我们的代码无关，多开会话、再装别的插件也会触发。
- 规避：在 profile 的 `cordis.patch.yml`（桌面版是 `~/.dsh/profiles/desktop/cordis.patch.yml`）末尾加下面一段，把检查器的单帧上限调到 1MB。按 DSH 规则这是整段替换，所以 `captureFetch: true` 要一起写上。树最多 2048 个节点，约 180KB，碰不到新上限；删掉这一段即可还原。
  ```yaml
  - id: experimental-inspector
    config:
      captureFetch: true
      maxSourceFrameBytes: 1048576
  ```
- 对 README 的影响：发布时要提醒用户，如果开着"开发者工具"（实验性检查器）又遇到这个崩溃，按上面的方法处理。**不要**点崩溃对话框里的"禁用第三方插件"，那会把所有第三方插件一起禁掉。

其他已落地的事实：
- npm 未登录，包名暂用 `@fky/dsh-threads`。
- vitest 5 需要单独装 `vite`。
- `.npmrc` 设了 `legacy-peer-deps=true`：DSH 的包对很多官方包写了精确版本的 peer 依赖，不加这一行 npm 会全装一遍。
- `dsh plugin add link:` 会报 "linked in dependency will not resolve the peer dependencies" 的警告。这是 pnpm 的提示，DSH 自己的运行时解析会处理，见 (a)。

### M1 单个讨论串闭环
- 依次写 `store.ts`、`manager.ts`（open/settle）、`report.ts`、`delivery.ts`、`install.ts`、`prompts.ts`，再写四个工具和 `/thread <任务>`。
- 打通两条路径：
  - `user_asked`：直接开；
  - `offer`：先弹 `userQuestions`。
- 讨论串继承主会话的审批模式，`maxRunning = 1`。
- 单元测试覆盖：
  - 唤醒规则的四种情况；
  - 防循环；
  - 便条截断；
  - 没有 `thread_report` 时的兜底；
  - 状态机。

**完成标准**：对主对话说一个任务，它开出讨论串；讨论串结束后调用 `thread_report`；主对话被唤醒，收到不超过 400 字的便条。

#### M1 落地情况（2026-10-23，分支 `feat/thread-open`）

范围上的取舍：
- M1 实现了 `thread_open`、`thread_status`、`thread_report` 三个工具和 `/thread <任务>` 命令。`thread_reply` 按 M2 的安排放到 M2。
- `initiation` 只开放 `user_asked` 和 `offer` 两种。模型自己想到的后续工作，提示词要求它"在回复里提一句、让用户决定"，不调用工具。`proposal` 留到 M2。
- 重启后的恢复（重新挂上运行中讨论串的状态监听）留到 M2。

实现上和计划不同的地方：
- **讨论串会话**：用 `sessionController.create` 建，再用 `resolveAgent` + `followup` 发简报，消息来源标记为 `dsh-threads`。"这一轮是谁发起的"由插件自己记录：主对话派的任务记 `dispatch`；讨论串空闲时收到用户消息，记 `user`。
- **工具和提示按会话挂载**：
  - 普通会话装 `thread_open`、`thread_status` 和调度员提示；
  - 讨论串装 `thread_report` 和讨论串提示；
  - 子代理和 Agent Team 成员（`origin: 'subagent'`）什么都不装。
- **存储**：拆成 `store.ts`（接口和内存实现）和 `storage.ts`（基于 storageDomain 的实现），这样单元测试不用加载 DSH 的存储包。

实机测试（本机桌面版，标准模式）：

| 路径 | 结果 |
| --- | --- |
| 用户说"开个讨论串：…" | 模型选 `user_asked` 调用 `thread_open`，侧栏出现"#1 …"。讨论串调用 `thread_report`（done）后，主对话被自动唤醒，并按"报告不是证据"自己复核了一遍。✅ |
| `/thread <任务>` | 立即开出 #2。这次讨论串**没调用** `thread_report`，兜底把它最后一条回复写进便条，主对话照常被唤醒。✅（兜底生效） |
| 加强措辞后再次 `/thread` | 讨论串的系统提示、工具描述、任务简报三处都改成"主对话只能收到 thread_report，结束前必须调用"。#3 主动回报了 done。✅ |
| `offer` | 弹出"要为「…」开一个讨论串吗？"卡片，三个选项加自定义输入。选"在主对话里做"后没有新建会话，主对话自己完成了任务。✅ |
| 防循环计数 | 两次自动唤醒后用户发了一条消息，`autoWakeStreak` 清零；之后再唤醒一次，计为 1。✅ |

还没在实机上覆盖的（已有单元测试）：
- 主对话忙时先压住便条、空闲后再送达；
- 用户在讨论串里自己聊出来的结果只进上下文、不唤醒；
- 超过 `maxRunning` 时拒绝；
- 建会话失败时把讨论串标记为 failed。

审批继承要在隔离的官方 DSH 上验收（第六节第 8 条），这次还没做。

### M2（2026-10-23 重排）：Claude 式「项目」界面

原来的 M2（侧栏列表 + 追加 + 提议 + 恢复）按用户要求改成和 Claude 原版一致的项目体验，拆成三个 PR。

**项目是什么（已确认）**
- **一个项目 = 一个本地文件夹（DSH 工作区）+ 一个常驻主对话**，有名字、置顶、项目说明。点项目直接进它的主对话。
- 讨论串只属于项目：
  - 只有项目主对话会装 `thread_open` / `thread_reply` / `thread_status` 和调度员提示，普通会话什么都不装；
  - 项目说明作为系统提示段，加给主对话和它所有的讨论串。

**界面扩展点**（`R` = `app/dsh/node_modules/@deepseek-ai`；所有插槽的类型、作用域和属性见 `R/dsh-cordis-client-runner/lib/client.js:2434` 的 `CLIENT_SLOT_API`）

| 需求 | 做法 | 参照 |
| --- | --- | --- |
| 左侧"项目"入口和项目页 | 侧栏入口插槽 `sidebar.panellist`（order 20）+ 整页面板插槽 `main`；进主对话用 `ctx.uiWorkspace.openSession`，回项目页用 `ctx.layout.selectPanel` | `R/dsh-client-ui-schedule/lib/client.js:7473-7490` |
| 置顶 | 项目记录存在插件表里，置顶时同时 `ctx.workspaces.pinSession(main)` | ui-workspace-controller 381-437 |
| 右侧讨论串面板（M2b） | 注册自己的资源协议 `dsh-threads` 和标签页；正文是 `SessionProvider` 包住 `renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active' })`。**不复用 `subagentchat`** | `R/dsh-client-ui-subagent/lib/client.js:699-839` |
| 回报渲染成讨论串卡片（M2c） | `ctx.uiConversation.events.register` 注册独占的事件解释器，把我们的消息变成自己的节点类型，再用 `conversation.chat.node` 渲染 | `R/dsh-client-ui-user-questions/lib/client.js:1349-1402` |
| "N 条回复"（M2c） | 按轮建事件解释器，把本轮 `thread_open` 打开的讨论串发布成轮数据，用 `conversation.chat.turnTail` 显示在这一轮的末尾 | schedule 2301-2358 |
| 提议卡片（M2c） | 输入框上方的 `conversation.input.dock` | goal 604-651 |
| 已解决后锁输入框（M2b） | `conversation.composer` 插槽链里加一个条目 | user-questions 1905-1925 |
| 左侧会话列表 | 不能把讨论串折叠或隐藏到主对话下；只能加小标记（`sidebar.session.row.leading`）、悬停卡片（`row.hover`）、菜单项（`session.menu.item`）。M2c 只做了小标记 | ui-workspace 964-974、2254-2368 |

**排期**
- **M2a（PR `feat/projects`）**：项目骨架、`thread_reply`、重启恢复、左侧"项目"入口和项目页、"设为项目"菜单。
- **M2b**：右侧讨论串面板（内嵌对话 + 输入框）、"标记已解决 / 重新打开"、主对话标题栏"讨论串 · N"。
- **M2c**：回报卡片、"N 条回复"、`thread_propose` + 提议卡片（超过上限的排队，空出名额时自动开始）、左侧标记。

#### M2a 落地情况（2026-10-23）

宿主端：
- 新增 `projects.ts`（新建、改名、置顶、移除、列表统计）和 `projects` 表；新字段都带默认值，M1 的旧记录照常能读。
- `install.ts` 按角色挂载（`roles.ts`）：项目主对话 = dispatcher，讨论串 = thread，其他 = none；项目变动后，正在运行的会话会重新计算角色。
- 新增 `thread_reply`：讨论串空闲时开新一轮；正在跑时排到下一轮，结果按唤醒规则回报。
- 新增 `recover()`：启动时把 `starting` 的讨论串标记为 failed；`running` 的用 `resolveAgent` 拿回 Agent，空闲就结算；待发的便条重新投递。
- `api.ts` 提供 `projects.*`、`sessions.role`、`threads.list`。

浏览器端：
- 左侧"项目"入口；
- 项目页：卡片、搜索、排序、置顶、移除确认；
- 新建项目对话框：名字、选工作区、项目说明；
- 会话菜单里的"设为项目"；
- 文案走 `ctx.locale`，样式用 `--dsw-alias-*` 主题变量；
- 公共组件用宿主共享的 `@deepseek-ai/dsh-client-ui-primitives`（`Button`、`Modal`、`MenuItemButton`）。

实机测试（桌面版，标准模式）全部通过：
- 左侧出现"项目"，项目页和空状态正常。
- 新建项目后直接打开它的主对话。主对话发出第一条消息后，标题变成项目名。
- 项目主对话里开讨论串（编号按项目从 #1 开始），做完唤醒主对话。
- 普通会话里 `/thread` 被拦下，并提示"先设为项目"。
- `thread_reply` 把追加任务发给了原来的 #1：开了新一轮、交了回报、主对话被唤醒。
- 重启恢复：在讨论串运行 `sleep 40` 时退出 DSH，再打开后，恢复逻辑结算了被中断的那一轮（无回报，用兜底），主对话被唤醒并自己重派了任务。
- 置顶后，卡片出现图钉，左侧列表里主对话移到最前。
- "设为项目"会把已有会话（连同它在 M1 开过的 3 个讨论串）变成项目；移除项目后会话仍保留。
- 没有新的崩溃日志。

注意：退出 DSH 时如果有任务在跑，会弹"当前正在运行的任务将会中断"的确认框；脚本里的 `quit` 会被它拦住。

#### M2b 落地情况（2026-10-23，分支 `feat/thread-pane`）

右侧讨论串面板：
- 资源协议 `dsh-threads`（`dsh-resource://dsh-threads/session/<id>`），打开时用 `sessions.retain(id, { source: 'dshThreads' })` 持有会话，标签页关掉才释放。
- 标签类型 `dsh-threads.chat`：
  - 正文 = 头部 + `SessionProvider` 包住自己声明的会话作用域子插槽 `dsh-threads.chat.conversation`，子插槽里是 `renderFactorySlot('conversation.content', { variant: 'embedded' })`，照抄 ui-subagent 的 `SidebarChatTab` / `ConversationSlotPanel`；
  - 不显示空白会话的开场页，避免出现工作区选择器。
- 头部：状态点、`#n 标题`、项目名、"标记已解决 / 重新打开"、"在主区域打开"。
- 原来的占位标签页换成"讨论串"列表（kind `dsh-threads`，引导页可进）：列出项目主对话的讨论串（状态点、最新摘要、时间、已解决标记），点击在右侧打开对话。
- 主对话标题栏（`conversation.session.header.actions`，order 15）：项目主对话显示"讨论串 · N（· M 个运行中）"，点击打开列表；讨论串显示"回到主对话"。

已解决锁定：
- 宿主端新增 `manager.setResolved`，接口 `threads.get` / `threads.resolve` / `threads.reopen` / `threads.resolved`。
- 浏览器端给每个已解决的讨论串发布一个低优先级的待处理交互（`ctx.uiSession.registerPendingInteraction`，kind `dsh-threads-resolved`）；输入框插槽链 `conversation.composer` 看到它就换成 `ResolvedComposer`（"此讨论串已解决 · 重新打开"）。
- 左侧列表只显示审批、计划确认、提问这三种待处理状态，所以不会多出标记。
- 有会话开始或结束运行、或者本浏览器标记 / 重开之后，重新同步已解决列表。

实机测试（桌面版，后台操作，没有接管屏幕）全部通过：
- 项目主对话标题栏显示"讨论串 · 1"，点击打开右侧列表。
- 点列表里的 #1，右侧打开它的实时对话，自带输入框。
- 在右侧直接给讨论串发消息：讨论串完成并回报；主对话没有被唤醒，唤醒计数也没增加，结果只进了上下文。
- "标记已解决"后，输入框换成锁定栏；"重新打开"后恢复。左侧列表没有多余标记。
- "在主区域打开"让讨论串占据中间区域，标题栏出现"回到主对话"；点回去后，主对话的右侧标签（列表 + #1）都还在。
- 没有新的崩溃日志。

#### M2c 落地情况（2026-10-23，分支 `feat/thread-cards`）

主对话里的卡片：
- 我们发进收件箱的每条消息（简报、追加、回报）在来源上带 `role`、`threads`（`threadId`、`n`、`title`，回报还有状态和摘要）和 `wake`（是开了新一轮，还是只进上下文）。
- 浏览器端用 `ctx.uiConversation.events.register` 注册 `noticeDefinition`：独占匹配 `source.kind === 'dsh-threads'` 的 `user/message`，生成节点 `dsh-threads-notice`，`conversation.chat.node` 渲染成卡片：
  - 回报："讨论串回报（N）"，每个讨论串一行：状态点、`#n 标题 · 状态`、摘要（去掉 markdown 标记）、"查看讨论串"；
  - 简报和追加："来自主对话的任务 / 追加指令 · #n 标题"，正文折叠显示。
- **踩到的坑**：没有 `groupTree` 的节点在已结束的轮里会被过滤掉（`dsh-client-ui-chat` 的 client.js:188），第一版卡片因此看不见。现在照 Chat 自己的 turn-trigger：`wake` 的消息设 `groupTree: 'input'`（坐在这一轮的输入位置），其他设 `'turn'`。M2c 之前的旧消息没有这些字段，显示成通用卡片。
- "N 条回复"：`openedDefinition` 按轮收集 `thread_open` 的工具结果（`presentationMeta` 带 `{ threadId, n, title }`），用 `buildLocationData` 发布成轮数据；`conversation.chat.turnTail`（order 25）在这一轮末尾显示"N 条回复"，每行的状态实时取 `threads.list`。没有用小数 `anchorSeq`，因为 turnTail 更稳，也不会和正文抢位置。

提议：
- 新工具 `thread_propose { items: [{ title, task }] }`，只装给项目主对话；调度员提示改成"自己想到的事用 `thread_propose`，不要直接开"。
- 提议存在 `proposals` 表：每次最多 `maxProposalsPerTurn`（3）个，`proposalTtlDays`（7）天后过期。
- 输入框上方的 `conversation.input.dock`（order 15）显示勾选卡片："都不要" / "开始 N 个讨论串"。点开始走 `proposals.start`：先全部标成 `queued`，再在 `maxRunning` 以内依次开；排不上的显示"排队中：有讨论串结束后自动开始"。
- 讨论串结束时**先开排队的提议，再投递回报**：这样这条回报会等排队的那个也做完，主对话一次收到整批，而不是每个讨论串各唤醒一次。

左侧标记：`sidebar.session.row.leading` 给讨论串行加讨论串图标、给项目主对话加项目图标（`sessions.kinds` 接口）。悬停卡片没做。

实机测试（桌面版，接管屏幕）全部通过：
- 回报显示成"讨论串回报（1）· 已完成"卡片，"查看讨论串"在右侧打开它。
- 用户消息那一轮末尾出现"1 条回复"，状态点跟着讨论串变化。
- 讨论串面板里的第一条是"来自主对话的任务 · #2 …"卡片。
- 左侧讨论串行和主对话行有各自的图标。
- 提议：主对话调 `thread_propose` 提两个，输入框上方出现勾选卡片；点"开始 2 个讨论串"，第一个立即开，第二个显示"排队中"，第一个结束后自动开始。
- 第一轮测试发现两条回报分两次唤醒了主对话（第一个结束时第二个还没开）；改成先开排队再投递后重测：第一个的回报等到第二个结束，主对话只被唤醒一次，卡片是"讨论串回报（2）"。
- 没有新的崩溃日志。

已知问题：DeepSeek Flash 经常不调 `thread_report`（这次 3 个里有 2 个没调），卡片显示"没有回报"，内容来自兜底的最后一条回复。之后考虑在没回报时提醒讨论串补一次。

### M3 并行与隔离；M4 发布

#### M3a 并行（2026-10-23，分支 `feat/parallel-threads`）

照 Claude 的做法：多个讨论串共用项目文件夹同时跑，靠规则避免冲突，worktree 留到 M3b。
- `maxRunning` 默认改为 3。
- 开讨论串按主对话串行：`thread_open` 和排队提议的启动走同一把锁（`manager.opening`）。同一步里并行调用多次 `thread_open`，也不会超过上限或拿到相同编号；两个讨论串同时结束时，排队的提议只会启动一次。
- 回报照旧"没有讨论串在跑才唤醒"。新增 `settling`：讨论串已标成空闲、但回报还没进队列的那一小段时间，投递仍把它算作运行中。否则两个讨论串几乎同时结束时，先到的回报会单独唤醒主对话。
- 提示：
  - 调度员：讨论串共用文件夹，只读的工作可以随便并行；会改文件的讨论串不能碰同一批文件，有依赖或改同一批文件就合成一个，或等前一个回报再开；回报会等所有讨论串都结束后一起到。
  - 讨论串：可能有别的讨论串同时在这个文件夹工作；只改任务需要的文件，不动别人的改动；除非简报要求，不提交、不切分支、不 stash、不 reset、不做全目录的格式化或批量改写。
- 实机测试（桌面版，后台操作，没有接管屏幕）通过：
  - 一句话让主对话开三个只读讨论串，三个在 0.2 秒内先后开出、同时运行，分别在 16、24、27 秒后结束，都调了 `thread_report`；
  - 前两个结束时回报被扣住（待发 1 → 2），第三个结束后主对话只被唤醒一次，卡片是"讨论串回报（3）"；
  - 那一轮末尾显示"3 条回复"；
  - 没有新的崩溃日志。

#### M3b worktree 隔离（2026-10-24，分支 `feat/thread-worktrees`）

照 Claude 的 `use_worktree`：会改文件的讨论串各开一个 git worktree 和分支，只读的照旧共用项目文件夹。
- `thread_open` 和 `thread_propose` 的每一项多了 `worktree`（布尔）；`/thread -w <任务>` 是手动入口。
- `src/worktree.ts` 自己跑 git（DSH 的 worktree 服务桌面版没装，也删不掉 worktree）：
  - 从项目文件夹的 HEAD 开新分支 `dsh-threads/<n>-<6 位 id>`，检出到 `<仓库根>/.agents/worktrees/dsh-threads-<n>-<id>`；
  - 池子和 DSH 用同一个目录，第一次建时写一个内容为 `*` 的 `.gitignore`，所以项目文件夹的 `git status` 看不到它；
  - git 调用都带 `-c core.hooksPath=/dev/null`（和 DSH 一样，不跑仓库自己的钩子）。
- 先建 worktree 再建会话：文件夹不是 git 仓库或还没有提交时直接拒绝，不留下空会话。会话建好后用 `workingDirectory.set` 切过去。
- 讨论串的系统提示按记录生成：有 worktree 时写明路径和分支，要求回报前把改动提交到这个分支，不推送、不合并、不切分支；没有 worktree 时照旧"别动别人的改动、不提交"。
- 回报便条在标题下一行写分支（放在最前面，截断时不会丢）；卡片数据带 `branch`，界面在 M3c 显示。
- 调度员提示：改文件就开 worktree；回报后把分支告诉用户，用户要求才合并，合并后可用 `/thread cleanup` 清理。
- 清理：`/thread cleanup` 列出不在运行的讨论串的 worktree；`/thread cleanup confirm` 才执行。`git worktree remove` 不加 `--force`，有没提交改动的跳过；分支用 `git branch -d`，有没合并的提交就保留。
- 测试：`tests/worktree.test.ts` 在临时仓库里跑真 git（开分支、池子自带 ignore、没提交的文件不带过去、非仓库和空仓库拒绝、干净的删掉、没合并的分支保留、有改动的不删）；manager 测试覆盖开串、拒绝、提议带过去、清理。
- 实机测试（桌面版，新 clone 的 playground 仓库，push 地址设成了 `no-push`）通过：
  - 主对话开了 `worktree: true` 的讨论串，讨论串在 `.agents/worktrees/dsh-threads-1-6edc0d` 里新建 `docs/PLAYGROUND.md` 并提交到 `dsh-threads/1-6edc0d`；
  - 项目文件夹 `git status` 干净，文件只在分支上；
  - 回报唤醒主对话，主对话自己核对了分支和提交，提示用户可以 `git merge` 再 `/thread cleanup`；
  - `/thread cleanup` 列出 #1，`confirm` 后 worktree 被删、分支因为没合并而保留；
  - 没有新的崩溃日志。

#### M3c Claude 式界面（2026-10-24，分支 `feat/claude-style-ui`）

用户要求：讨论串不出现在左侧会话列表；颜色、布局照 Claude（黄色举手、呼吸状态灯、绿色 md 文件图标），做一套完整、有高级感的界面。

左侧栏：
- DSH 的会话列表整个是 `sidebar.workspaces` 一个插槽，`sessionVisible` 是闭包，没有按行过滤的扩展点；把讨论串设成 `origin: 'subagent'`（DSH 会自己隐藏）不行，那样用户就不能直接给讨论串发消息；归档也不行，归档会话不能运行。
- 做法：`kinds.ts` 按 `sessions.kinds` 生成一段样式，用 `[data-row-key="session:<id>"]{display:none}` 隐藏讨论串行，并在主对话行的时间格前加 `↳ N`（行结构是 `slot | title | time | actions`）。
- 主对话行的前置格（`sidebar.session.row.leading`）：有讨论串在等用户时显示黄色举手，有讨论串在跑时显示呼吸点，否则空着；主对话自己忙时 DSH 会用它自己的状态点占这一格。
- 已知小问题：每个工作区默认只显示 5 行，DSH 计数时把隐藏的讨论串也算进去，所以讨论串多的工作区里可见行会变少，"展开其余 N 个会话"的 N 也包含讨论串。

设计（`glyphs.tsx`、`ui.tsx`、`styles.ts`）：
- 状态记号统一由 `glyphState` 算：运行中 = 蓝色呼吸点（`prefers-reduced-motion` 时不动），等用户 = 黄色举手，完成 = 空心圆，已解决 = 绿色对勾，失败 = 红色叉，排队 = 时钟。侧栏、卡片、列表、面板头、标题栏按钮都用同一套。
- 组件：`ThreadItem`（状态、`#n` 标题、状态词、摘要、"等你决定"琥珀色块、分支和文件小标签；等用户时显示"查看讨论串"，否则悬停出现箭头）、`FileChip`（文档绿、代码蓝、数据黄）、`BranchChip`（紫色、等宽字）、`Pill`（普通 / 反色主按钮 / 图标）、`CardHead`。
- 颜色用 DSH 的主题变量，只自定义几种状态色（`--dsht-*`），深浅色都能用。
- 回报卡片：等用户的排前面；卡片里的状态是**实时**的（像 Claude），讨论串之后被标记已解决就不再显示举手；摘要、文件、分支保持回报当时的内容。同一会话里多张卡片同时刷新时共用一次请求。
- "↳ N 条回复"改成紧凑的一行一个讨论串（像 Claude 的内联讨论串卡片），细节留给回报卡片。
- 提议卡片照 Claude："建议的讨论串"，每行有自己的开始按钮（↩）和悬停出现的"不要这个"，底部"都不要" / "开始 N 个讨论串"；带 worktree 的提议有紫色"独立 worktree"标签。
- 讨论串面板头：状态记号、`#n 标题`、项目名、分支标签（worktree 删掉后划线变淡）、"标记已解决 / 重新打开""在主区域打开"。已解决的输入框照 Claude："✓ 此讨论串已解决。请重新打开以发送更多消息。[重新打开]"。
- 讨论串列表：等用户的在前、运行中其次、已解决最后。
- 标题栏按钮：有等待时显示举手和"N 个等你回复"，有运行时显示呼吸点。
- 项目页卡片：悬停微微上浮，运行中带呼吸点；输入框和图标底色提高对比度。

新建项目可以直接填文件夹路径（照 Claude）：
- 下拉框多一项"其他文件夹…"，填完整路径；宿主用 `ctx.workspaceRegistry.create(path, title)`（已是工作区就复用，否则新建）。

实机测试（桌面版）通过：
- 侧栏：讨论串行全部隐藏，"Playground ↳ 4""测试项目 ↳ 9"；讨论串运行时主对话行和标题栏出现蓝点，等用户时出现黄色举手。
- 一次开两个讨论串（一个 worktree 并以 needs_decision 回报、一个只读）：回报卡片里等待的排第一，有琥珀色"等你决定"、紫色分支、绿色 md 文件标签和"查看讨论串"；标记已解决后，这张旧卡片变成绿色对勾"已解决"。
- 紧凑的"↳ 2 条回复"、提议卡片（单个开始、全部开始）、面板头分支标签、已解决输入框、列表排序都正常。
- 用"其他文件夹…"按路径建项目，复用了已有工作区；测试项目随后移除。
- 没有新的崩溃日志。

#### 回报提醒（2026-10-24，分支 `fix/report-reminder`）

M2c 时 DeepSeek Flash 常常不调 `thread_report`（3 个里 2 个），卡片只能显示"没有回报"。
- 主对话派的一轮（`dispatch`）结束时如果没有本轮的回报，先不结算：给讨论串发一条 `role: 'reminder'` 的提醒（"你结束了这一轮，但没有调用 thread_report……现在调用一次"），这一轮保持 `running`，主对话的回报继续扣着。
- 每轮只提醒一次（`ThreadRecord.reminder`，新一轮开始时清空）。提醒前先把讨论串这一轮的最后一条回复存进 `reminder.fallback`：如果提醒后还是没回报，兜底用的是**提醒之前**的那条回复，而不是它对提醒的回答。
- 用户自己在讨论串里聊的一轮（`user`）不提醒。
- 配置 `reportReminder`（默认开）。界面上提醒显示成"提醒回报"卡片。
- 测试：提醒后回报正常送达；提醒后仍不回报时用提醒前的回复兜底；用户轮不提醒。
- 实机：这次怎么也没让模型漏掉回报（简报和追加里都明确说"不要调用 thread_report"，它两轮都还是调了），说明 M2c 之后加强的提示已经很有效；提醒这条路径由单元测试覆盖，完整流程测试时继续观察。

#### M4 发布 v0.1.0-rc.1（2026-10-24，分支 `release/v0.1.0-rc.1`）

- 用户确认：公开发 `v0.1.0-rc.1` 预发布版；awesome-dsh-plugin 收录等稳定版 `v0.1.0` 再提交。npm 没登录，先只发 GitHub Release（Plan.md 也是这个顺序）。
- `package.json`：版本 `0.1.0-rc.1`，补 `keywords`（含 `dsh-plugin`）、`homepage`、`repository`、`bugs`；`files` 加上 `README.zh.md`、`CHANGELOG.md`。仓库话题早就有 `dsh-plugin`。
- README（中英）：功能、安装（Release 的 `.tgz` 地址或 `github:` 地址）、使用、配置表、已知限制。
- **用打包出来的 `.tgz` 在官方原版 DSH 上验证过**：
  - 隔离环境 `DSH_HOME=~/dsh-clean`，`npx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web add <tgz>`；本机没有 `pnpm`，用一个小脚本指向桌面版自带的 pnpm 11.28.5。
  - pnpm 只装了插件本身（peer 依赖没有被另装一份），宿主照样把 `@deepseek-ai/*` 解析到自己的那份。
  - `dsh web` 打开后：左侧有"项目"，项目页走 `POST /api/dsh-threads` 正常读出空列表，新建项目会打开主对话，`/thread` 命令（带新的 `-w` / `cleanup` 说明）在命令列表里。
  - 审批继承还是没法在这里验证：隔离环境没有模型登录，需要用户自己登录后再测。
- 发布：合并后在 `main` 上打 `v0.1.0-rc.1` 标签，`gh release create --prerelease`，附 `npm pack` 出来的 `fky-dsh-threads-0.1.0-rc.1.tgz`，说明取自 CHANGELOG。

- **v0.1.0-rc.2**（同日，用户确认后发布）：只加 rc.1 之后合并的两个修复（唤醒计数清零的竞态 #10、主题颜色变量失效 #11）和对应的界面小改动；版本号、README 安装地址、CHANGELOG 跟着改。
- **v0.1.0-rc.3**（同日，用户确认后发布）：照 Claude 重做的项目页、新建项目对话框和卡片菜单（#13），项目设置里的模型和使用情况（#14），项目桌面通知（#15）；版本号、README 安装地址、CHANGELOG 跟着改。
- **v0.1.0-rc.4**（同日，用户确认后发布）：运行灯改成原地明暗呼吸（#17），侧栏单独的“项目”分组，以及讨论串状态晚一步刷新的修复（#18）；版本号、README 安装地址、CHANGELOG 跟着改。
- **v0.1.0-rc.5**（同日，用户确认后发布）：回报里引用用户在讨论串里的原话、方案交给讨论串去出、主对话保持空闲（#20）；版本号、README 安装地址、CHANGELOG 跟着改。

#### 完整流程实测（2026-10-24，v0.1.0-rc.1）

在 playground 仓库（push 已关）的 Playground 项目里，像普通用户一样提了一个两件事的真实请求：修 `plainLine` 对 markdown 链接和表格的处理并补测试；审查 `src/delivery.ts` 的唤醒规则（只读）。
- 主对话自己决定分工：审查开成讨论串 #6（只读，没开 worktree），`plainLine` 这件小改动自己做（照 Claude 的"几个工具调用就能做完的事自己做"）。两边并行。
- #6 正常回报（`done`），主对话被唤醒一次，自己复核后给出结论，还补了两点；`plainLine` 改完 113 个测试全过。按用户要求提交到本地 `main`（`beff024`，没推送）。
- `/thread cleanup` → `confirm`：删掉了 #2 的 worktree，分支因为有没合并的提交而保留。
- 这次审查找出插件自己的一个真问题，已修（分支 `fix/streak-reset-race`）：
  - **用户开口时清零唤醒计数不在投递链里**。`flush` 先读主对话记录，等 `host.resolve` 返回后再把读到的那份写回；这中间用户说话做的清零会被覆盖，之后自动唤醒继续被压着。修法：`onMainUserMessage` 也走 `serial`。测试先复现（失败），修后通过。
  - `maxAutoWakes: 0` 的含义写进配置说明和 README："从不自动唤醒"。
- 审查的另外几点，判断后没改：
  - "streak 到顶后 note 从 `pendingNotes` 里删掉、只靠 inject"：quiet 的 note 一直都是 inject 进收件箱，靠 DSH 把收件箱记进会话日志；和"用户自己聊的轮次"走的是同一条路。
  - "dispatch 轮里用户插话也该算安静"：主对话派的任务按设计要大声回报，主对话在等结果。
  - "两个讨论串同时结束时 settling 有竞态"：M3a 已经处理，并有测试（第二个在第一个投递途中结束）。

#### 界面细节打磨（2026-10-24，分支 `polish/ui-details`）

逐个界面在深色（桌面版）和浅色（隔离的 Web 版，浏览器模拟浅色）下过了一遍：
- **修了一个真 bug**：派生的颜色变量（边框、悬停、按钮底色、焦点环）写在 `:root` 上，但 DSH 把主题变量（`--dsw-alias-*`）定义在 `body` 上，`:root` 那里取不到值，这些变量整个失效。之前看到的"按钮底色太淡""输入框边框看不见"都是这个原因；浅色模式下项目卡片甚至没有边框，和背景混在一起。现在固定颜色留在 `:root`，派生变量在 `body` 和插件自己的元素上计算。
- "↳ N 条回复"紧凑卡片按内容宽度显示（像 Claude 的内联讨论串卡片），不再拉满。
- 讨论串面板头的按钮加了图标（✓ 标记已解决、↺ 重新打开、⤢ 在主区域打开）。
- 项目卡片静止时也有很淡的阴影，浅色模式下更清楚。
- 看过、没改：侧栏的 `↳ N` 用文字字符（换成图标得用 CSS 遮罩，就没法同时显示数字）；回复卡片和回报卡片之间的空隙是 DSH 自己的轮次间距。

#### 项目页照 Claude 重做（2026-10-24，分支 `feat/projects-like-claude`）

用户拿 Claude 的截图提了几点：新建项目对话框太丑，要像 Claude 那样直接弹系统文件夹选择器；项目卡片要有 Claude 的"⋮"菜单、通知档位和项目设置。计划分三个 PR，这是第一个。

- **查到的 DSH 能力**：
  - 系统文件夹选择器：桌面版 `globalThis.__DSH_DIRECTORY_PICKER__.pick()`（Electron 的 `dialog.showOpenDialog`），其他情况 `ctx.uiWorkspace.pickDirectory()`；Web 版是 browse 模式时会抛 `directory-picker/unavailable`。
  - 组件：`Menu` 支持快捷键提示、子菜单、`danger`、分隔线、`label`；`Modal` 的 `headless` 能自己排版。
  - 会话归档：`workspaceRegistry.archiveSession` / `unarchiveSession`。
- **新建项目对话框**（`NewProjectDialog.tsx`，`headless` 的 `Modal`）：
  - 名称，加一整行"选择文件夹…"按钮：点击弹系统选择器，取消不变；选好后显示文件夹名、灰色路径和"更改"，名称还空着时自动填文件夹名。
  - 右上角"最近的文件夹"列出已有工作区。
  - 没有选择器时（Web 的 browse 模式）这一行变成路径输入框。项目说明从这里拿掉，放到设置的"记忆"页。
- **项目页**（`ProjectsPage.tsx`）：
  - 标题右边是"排序方式 最近活动 ⌄"（按钮 + `Menu`，当前项打勾）和分体的"新建项目 | ⌄"（⌄ 里可以用已有工作区新建）。
  - 卡片：图标方块、名称加蓝色图钉、"时间 · N 个讨论串 · 运行中"；文件夹路径挪进设置页。
  - 悬停出现竖排的"⋮"，菜单有：置顶 P、通知 ▸（四档，带说明，当前项打勾）、设置 S、归档 A、删除 D（红色，确认后只删项目记录）。菜单打开时直接按字母键就生效（我们自己监听键盘）。
  - 底部可展开"已归档 · N"。
- **归档**（宿主 `Projects.archive` / `unarchive`）：
  - 有讨论串在跑就拒绝；主对话归档失败（还在运行）也拒绝。
  - 成功后主对话和所有讨论串在 DSH 里归档（从侧栏消失、不能运行、数据不删），项目取消置顶。取消归档反过来。
  - DSH 发现"当前会话"被归档时会把主区域切到新会话，所以归档后页面会把自己重新选回来。
- **项目设置**（`ProjectSettings.tsx`，大约 820px 的 `headless` `Modal`，左侧导航）：
  - **通用**：名称和图标（图标按钮展开 24 个图标的网格）、目标（`0 / 8,000` 计数，只加进主对话的系统提示）、文件夹（只读）。
  - **记忆**：项目说明（`0 / 4,000`）。
  - 文本失焦或关闭对话框时保存，图标立即保存。模型和使用情况在下一个 PR。
- **侧栏**：主对话行没有举手或运行中时，前置格显示项目图标。
- **数据**：`ProjectRecord` 加了 `icon`、`goal`、`archived`、`notify`、`mainModel`、`threadModel`，都带默认值。通知档位这次先存下来，下一个 PR 接上系统通知。
- **测试**：新字段默认值和更新、归档和取消归档（会话被归档 / 恢复）、有讨论串在跑或主对话忙时拒绝、目标只进主对话的提示，共 74 个。
- **实机测试**（桌面版，浅色）通过：
  - 页面和卡片的样子与 Claude 截图一致；菜单项、快捷键提示、通知子菜单（打勾和说明）都对；改通知档位后菜单右侧跟着变。
  - S 打开设置；换图标、写目标都保存了（存储里能看到）。
  - 新建项目：系统选择器弹出，取消不变，选好后名称自动填，"最近的文件夹"可以换。
  - A 归档：测试项目连同 9 个讨论串一起归档，页面留在项目页；在"已归档"里 A 取消归档后恢复。
  - 侧栏主对话行显示项目图标；没有新的崩溃日志。

#### 项目设置：模型和使用情况（2026-10-24，分支 `feat/project-settings`）

计划的第二个 PR。
- **模型**（"通用"页的"模型"分组，照 Claude 的四行）：
  - 协调器模型和思考强度、讨论串模型和思考强度。下拉用"按钮 + `Menu`"，DSH 没有 Select；选项来自 `models.catalog`（转发 `sessionController.modelCatalog()`），按服务商分组。
  - 第一项是"默认（当前 DSH 默认模型）"；思考强度只列所选模型支持的档位，第一项是"默认（这个模型的默认档）"。跟随默认时思考强度不可选。
  - 协调器模型改了就立刻对主对话生效；讨论串模型存在项目上，新讨论串开出来、发简报前套用（`manager.openNow`），DSH 用不了这个模型时记一条 warn，照常开串。
- **不改用户的全局默认模型**：DSH 的 `sessionController.selectModel` 会顺带把选择存成"新会话默认模型"。`agentDefaultModel.saveSelection` 按提交顺序执行，所以先记下原来的默认、调用 `selectModel`、再把原值存回去，结果不变。
  - 实测：协调器换成 Pro、讨论串换成 Pro + Low 之后，profile 里的默认仍是 `deepseek-flash / high`；文件被 DSH 重写过，但其他内容（注释、预设、检查器那段）都在。
- **使用情况**（新的导航页）：
  - 宿主 `projects.usage` 对主对话和每个讨论串调 `sessionController.projections(...)`，读 `tokenUsage`（会话没加载也能读）。
  - 输入 = 未缓存 + 缓存读 + 缓存写（和 DSH 自己的用量标签一样）。顶部是合计，下面一张表：主对话在前，讨论串按用量从多到少；DSH 不记费用，所以只有 token。
- **测试**：协调器模型生效、DSH 拒绝时项目记录不变、讨论串模型只存不立即生效；开讨论串时套用讨论串模型、失败照常开；用量汇总和排序。共 77 个。
- **实机测试**（桌面版，浅色）通过：
  - 模型目录读出 DeepSeek Account 的 Flash / Pro。
  - 协调器换成 Pro 后，主对话输入框的模型标签变成"DeepSeek-V4-Pro · High"；讨论串设成 Pro + Low 后，`/thread` 开出的 #7 的请求头是 `deepseek-v4-pro / low`。
  - 全局默认没变；使用情况显示合计 3.4M / 55K 和每个会话的明细。
  - 测完把 Playground 的两个模型都改回默认；没有新的崩溃日志。

#### 项目通知（2026-10-24，分支 `feat/project-notifications`）

计划的第三个 PR：让卡片菜单里的通知档位真正生效。
- DSH 自己没有任何会话通知，所以由插件的浏览器端（`src/client/notify.ts`）来发：
  - 订阅 `uiSession.sessionStatus`，记下从"运行"变成"空闲"的会话；同一批（讨论串一起结束、它们唤醒的主对话）600ms 内合并。
  - 只在 DSH 窗口不在前台时（`document.hasFocus()` 为假或页面不可见）才问宿主要通知内容；在前台时不打扰，侧栏的记号已经够了（Claude 也是这样）。
  - 宿主 `notifications.describe { ids }` 用纯函数 `notifyTarget` 说明每个会话：属于哪个项目、档位、是不是在等用户决定，以及一句去掉 markdown 的正文（等待的讨论串用要用户决定的问题，做完的讨论串用摘要，主对话用最后一条回复）。不属于项目或项目已归档的会话不通知。
  - 档位规则（`wantsNotification`）：所有新消息 = 主对话和每个讨论串；主对话与需要你处理的（默认）= 主对话 + 等你决定的讨论串；仅需要你处理的 = 等你决定的讨论串；无 = 不发。
  - 用网页自己的 `Notification`：标题是项目名（讨论串加"#n 标题"），`tag` 按会话，同一会话的新通知替换旧的。点击通知会把窗口带到前面，打开主对话；如果是讨论串，再在右侧打开它。
  - 权限还是 `default` 时先 `requestPermission()`；桌面版里是 `granted`（Electron 的权限处理只管 media）。
- **测试**：档位规则表、`notifyTarget`（主对话用最后一条回复的纯文本、等待的讨论串用问题、不属于项目和已归档的忽略），共 81 个。
- **实机测试**（桌面版）：
  - 把 Playground 设成"所有新消息"，发一条 `sleep 8` 的消息后把访达放到前台。
  - 用临时调试日志（之后删掉了）确认：主对话结束时窗口在后台，权限是 `granted`，`new Notification(...)` 确实为主对话调用了。
  - 我的截图工具会隐藏白名单以外的窗口，看不到系统通知横幅本身。横幅是否显示还取决于 macOS 对 DeepSeek Harness 的通知设置，需要用户自己看一眼。

#### 侧栏单独的“项目”分组（2026-10-24，分支 `feat/sidebar-projects`）

用户说还不够“项目”：主对话混在“工作区 → 文件夹 → 会话”里，看起来就是一条普通对话。要像 Claude 那样，侧栏有单独的“项目”分组，每个项目一行，点进去就是主对话。
- **DSH 没有给插件在侧栏加分组的插槽**：
  - 侧栏是 新会话 → `<nav>`（`sidebar.panellist`）→ `regionArea` 里的 `sidebar.workspaces` → 底部。
  - `sidebar.workspaces` 是 single 插槽，DSH 的 `WorkspaceBrowser` 占着。
- **实验：包住 `sidebar.workspaces`，失败。**
  - `ctx.slots.entries('sidebar.workspaces')` 能拿到官方登记项：`component`、`inject`、5 个子插槽声明、`store`（持久化键 `dsh.workspace.view.v5`）、`locale: 'workspace'`。
  - 登记同名项要显式 `priority: -1`；否则报“single slot already has a registration at priority 0”。
  - 照抄子插槽声明会报 `slot "sidebar.workspaces.directoryFlow" is already declared`：一个子插槽只能声明一次。不声明的话，官方组件自己的会话菜单、行前置格都渲染不了（`SlotOwnershipError`）。所以不能包。
- **做法：portal 插到 `<nav>` 后面**（`src/client/SidebarProjects.tsx`）。
  - 我们“项目”导航图标（`PanelIcon`）用 `useSidebarAnchor` 报告它所在的 `<nav>`，以及侧栏是否展开（图标 16px 是展开，18px 是窄条）。
  - `shell.overlay`（list 插槽，常驻、可叠加）里登记 `SidebarProjectsHost`：在 nav 后面插一个 `div.dsht-side`，`createPortal` 渲染分组。`react-dom` 在宿主模块表里（first-party 包都在 `require("react-dom")`），类型来自新加的 devDependency `@types/react-dom`。
  - 找不到 nav 就不渲染。侧栏隐藏再打开时，图标重新挂载，分组跟着回来。
- **分组**：
  - 样式照 DSH 的“工作区”量过：标题 36px、14px 灰字；行高 32px、左右 8px、16px 前置格；悬停和选中用 `--dsw-alias-interactive-bg-hover`。
  - 前置格：讨论串等你 → 举手；主对话或讨论串在跑 → 呼吸点；否则显示项目图标。右侧显示置顶图钉和 ↳N，悬停时换成“⋯”。
  - 排序：置顶在前，再按最近活动；不显示已归档的。超过 8 个时显示“展开其余 N 个”。
  - 标题点一下可以折叠，状态存 `localStorage`。“+”新建项目。
  - 高亮照 DSH 自己的规则：没有选中的面板时，`retainedBy.mainView > 0` 的会话就是当前会话（`dsh-client-ui-workspace` 的 `FlatList`）。
  - 卡片的“⋮”菜单、设置对话框、删除确认框抽成 `src/client/ProjectActions.tsx`，项目页卡片和侧栏行共用。
- **从“工作区”里拿掉项目**（`src/client/kinds.ts`）：
  - 主对话的行和讨论串一样，用生成的 CSS 按 `data-row-key="session:<id>"` 隐藏。原来主对话行的 ↳N 和 `MainRowMark` 删掉了。
  - DSH 的行 key 还有 `workspace:<id>`（工作区标题行）和 `overflow:<id>`（“展开其余 N 个会话”）。
  - 只剩项目会话的工作区整组隐藏，在浏览器端算（`projectOnlyWorkspaces`），规则照抄 DSH 的 `sessionVisible`：
    - 不算的会话：列表里没有的、空的（当前打开的除外）、子代理的、归档的；
    - 一开始放在宿主算，结果默认工作区里一个没用过的空会话让它“不空”，所以改到浏览器端，用 DSH 的工作区快照（`items[].sessionIds`、`archivedSessionIds`）和会话列表（`blank`、`origin`）。
- **测试**：`sidebarCss`、`sidebarProjects` 排序、`projectOnlyWorkspaces`（空会话、归档、子代理、当前空会话），共 84 个。
- **实机**：
  - 桌面版：Playground（置顶，↳7）、test1（↳3）、测试项目（↳9）出现在“项目”里；dsh-threads-playground 和 dsh-threads-test1 两个工作区整组消失，默认工作区（有普通会话）照常。
  - 点行打开主对话并高亮；“⋯”菜单能用，点它不会误开项目；“+”打开新建对话框；折叠、展开正常；侧栏隐藏再打开后分组还在。
  - 隔离的 Web 版：浅色、深色都正常。
- **整体实测**（用户要求：不提讨论串，给几件事；开串后马上再提新需求），test1 项目：
  - 一次给三件事：最高分记录、GitHub Pages 部署调研文档、README。主对话自己开了 #4（最高分）和 #5（部署文档），README 说等两个分支合并后按最终代码写。
  - 开串后马上提“把网页标题改成 Snake · 霓虹版”。主对话 6 秒就回了：转给正在改 `index.html` 的 #4，没有重复开串，理由是避免合并时撞同一行。
  - #5 先做完，回报按规则压着（还有讨论串在跑就不唤醒）。#4 做完后主对话被唤醒，合并两个分支，写 README 和截图，`node test.js` 13 个全过。侧栏 test1 一直显示呼吸点和 ↳5，做完变回项目图标。
  - **发现的问题**：#5 先做完时，主对话里的回复卡片和标题栏还显示它“运行中”。
    - 原因：卡片只在运行集合变化时重新加载，加载时宿主还没把 #5 记成完成。之后 #4 一直在跑，运行集合没再变化，所以一直没刷新。
    - 修法：`syncKinds` 发现有会话停下，1.5 秒后再 `threadsRevision.bump()` 一次，所有讨论串视图都会重新加载。

#### 用户在讨论串里要的改动写进回报；方案交给讨论串（2026-10-24，分支 `fix/dispatch-user-words`）

用户照测试指令跑了一遍 test1，发现两处和预想的不一样。
- **主对话以为是讨论串自作主张**：
  - 用户直接在 #6 里说“困难模式起步提到 60ms”，#6 改好并回报了。
  - 这一轮是用户发起的，回报照规则静默送进主对话，内容和普通回报一样。主对话正在合并 #6，看到后写“#6 又追加了一个我没要求的提交 7623a65，我没有合并它”，然后让用户确认。
  - 修法：`ThreadRecord.userMessages`（zod 默认 `[]`）记下这一轮里用户在讨论串里说的话：`onInbox` 现在也拿消息正文（`textOf(message.content)`），最多留最近 5 条，新一轮开始和结算时清空。
  - `composeNote` 紧跟在标题和分支行后面写一行：用户发起的一轮写“这一轮是用户自己在讨论串里要求的，不是讨论串自作主张。用户的原话：「…」”；派发的一轮里用户插话，就写“这一轮中用户在讨论串里说过：「…」”。每条最多 200 字。
  - 调度提示：带用户原话的回报就是用户的决定，照之前处理这条讨论串的方式接着做（合并过就把新提交也合并），告诉用户，不再让用户确认。
- **皮肤方案没交给讨论串**：
  - 用户要“先给三个方案选，我选了再做，单独开讨论串”。主对话自己想了三个方案，用 DSH 的 `ask_user_question` 在主对话里问；用户选了 A 才开 #8。讨论串从来没举手。
  - 同一时间主对话醒来后自己做了两分多钟的重活：合并、78 项浏览器断言、截图、改 README。用户的新需求排了大约半分钟队。
  - 调度提示改了三处：
    - 要用户挑方案的事，直接开讨论串，让讨论串给出方案、`needs_decision` 停下，主对话不先出方案、不先问。
    - 新增“Keep this conversation free”：主对话的回合要短，收到回报只合并用户要的、跑项目自带的测试、告诉用户进度；浏览器、截图、长脚本和新写文档交给讨论串。
    - “回报不是证据”改成“便宜地核对（diff、项目测试）并说明哪些没验证，深的核对交给讨论串”。
  - 讨论串提示：任务书要求先给方案时，把每个方案写清楚、列进 decisions、`needs_decision`，用户选之前什么都不做。
- **实机（桌面版）**：
  - test1 里重发同类需求（“标题 logo，先给三个方案选，单独开讨论串”），主对话还是自己出方案、用提问框问。思考里写的是“Same pattern as skin”，打断重发后写“The question was aborted. Re-ask”：这段对话里已经有两次同样的先例，模型照先例做。所以把规则写得更硬：点名不许用 `ask_user_question` 做这种选择，并注明“即使这段对话之前这样做过”。长对话里已有的先例仍可能压过规则。
  - Playground（没有这种先例）：“README 开头标语，先给三个方案选，单独开讨论串”。主对话直接开 #10，任务书要求“交三个方案、needs_decision、选定之前不动文件”；#10 举手，卡片显示“待你决定”。
  - 在 #10 里直接回复“选方案 2，中英文两个 README 都改”。#10 提交后的回报写着“这一轮是用户自己在讨论串里要求的……用户的原话：「选方案 2……」”。问主对话“#10 那边现在什么情况”，它的思考第一句是“The user chose plan 2 in the thread”，照常问要不要合并（这个分支之前没合并过）。
  - 发现 #10 举手后，主对话又用提问框把同一个问题问了一遍，占住了主对话。补一条：讨论串等用户决定时，主对话用一两句话说明，不再用 `ask_user_question`。重测（#11，CHANGELOG 副标题）：主对话只用文字说“你选 1/2/3，我转给 #11”，输入框一直可用。
- 用户先前怀疑那个提交丢了，我起初也判断成“丢了”；实际是主对话看到了、等用户确认。“静默回报压到下一轮”“回报写明未合并的提交”这两个想法这次没做。
- **测试**：`composeNote` 引用用户原话（用户发起的一轮、派发的一轮里插话、没有原话），`onInbox` 记录并在结算后清空，共 85 个。

#### 正式版前的修复（2026-10-25 起，docs/RELEASE-PLAN.md 阶段 1）

- **删除项目后讨论串回到会话列表**（分支 `fix/orphaned-threads`）：
  - 原来删除项目只删项目记录，讨论串记录还在：`sessions.kinds` 照旧把它们从 DSH 的列表里藏起来，`roleOf` 照旧给它们装 `thread_report`，和确认框说的“保留为普通会话”不符。
  - 现在“讨论串”按两种算：`isThread` 只看有没有记录（讨论串不能设为项目、不能再开讨论串，照旧）；`isProjectThread` 还要求它的主对话仍是项目的主对话，角色、侧栏隐藏、已解决锁定都看这个。用户在这种会话里说话不再开一轮、也不再往原主对话送回报。
  - 删除项目和归档一样，有讨论串在跑时拒绝。
  - 把原来的主对话重新“设为项目”，这些讨论串会自动回来。
- **审批继承取不到主对话就不开串**（分支 `fix/inherit-permission`）：
  - 原来 `inheritPermission` 只用 `ctx.agents.get` 拿已加载的主对话，拿不到就什么都不做。新会话由 `pinInitialPermission` 钉成**用户默认**模式，所以 DSH 重启后由 `recover()` 启动的排队提议、或主对话被卸载时开的讨论串，可能比主对话更宽。
  - 现在开串第一步（建 worktree 和会话之前）就用 `resolveAgent` 读主对话的模式（`host.permissionOf`），读不到就拒绝，什么都不留下；会话建好后 `setPermission`，失败则讨论串记为 failed，简报不发。
  - 主对话是 `custom`（沙箱和审批开关对不上任何模式）时也拒绝：`permissionPresets.set` 只接受真实的模式名，原来这种情况会在建好会话后抛错，留下一个失败的讨论串。
  - DSH 没有 `permissionPresets` 服务时照旧开串，记一条 warn。

#### 之后
- 发布：
  - GitHub Release 附 `.tgz`；
  - npm 用作用域包。

---

## 六、验证

1. 本地自动检查：`npm run typecheck && npm test && npm run build`，全部通过；`dist/` 里的 `client.js` 以 `window.__ModuleLoader__.load(` 开头。
2. 安装：完全退出 DSH，执行 `scripts/dev-install.sh`，再打开 DSH。
   - 插件页能看到插件；
   - 新会话的工具列表里有 `thread_*`；
   - 右侧栏有"讨论串"标签。
3. M1 端到端：
   - 对主对话说："开个讨论串：列出 src 下的文件并各用一句话总结"。
   - 侧栏出现新会话，标签页里显示 running。
   - 结束后主会话出现一条 notice 并自动继续，摘要不超过 400 字。
4. `offer` 路径：只说任务、不提"讨论串"。如果模型选了 `offer`，会弹出三个选项；选"在主对话做"，不应该新建会话。
5. 点击标签页里的条目能跳到讨论串；在讨论串里直接发一条消息，主会话不应该被唤醒。
6. 防循环：把 `maxAutoWakes` 设为 2，连续派 3 个短任务，第 3 条只进上下文、不唤醒。
7. 重启 DSH：讨论串列表还在，对旧讨论串 `thread_reply` 成功。
8. **在隔离的官方 DSH 上**（不动桌面版）：
   - 启动：
     - `export DSH_HOME="$HOME/dsh-clean"`
     - `npx -y @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web add "link:$PWD"`（在仓库根目录执行）
     - `npx -y @deepseek-ai/dsh@0.2.1-rc.2 web --port 8787`
   - 第一次打开要在网页里自己登录 DeepSeek 账号；测完删掉 `~/dsh-clean` 即可。
   - 主会话设成 ask 模式，讨论串执行写文件时会弹出审批；
   - 不能出现"后台讨论串自动通过"。
