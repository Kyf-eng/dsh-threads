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
| `use_worktree` | M3：`ctx.worktrees.create(agent, { name })` |

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
| `maxRunning` | 1（MVP）；M3 改为 3 |
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

### M2 面板、追加、提议、恢复
- 加 `thread_reply` 和 `proposal` 流程（`/thread start`、提议过期）。
- 写 `rpc.ts`。
- 写 `ThreadsTab.tsx`：
  - 显示序号、标题、状态点、最新摘要、token，点击跳到讨论串；
  - 提议显示"开始 / 忽略"按钮；
  - 当前会话本身是讨论串时，显示"回到主对话"。
- 用户自己在讨论串里聊出来的结果：不唤醒主对话，只进上下文。
- 重启恢复：启动时扫描 `threads` 表，用 `resolveAgent` 补上状态监听；停在 `running` 的讨论串重新判断一次是否已完成。

**完成标准**：
- 侧栏能看到所有讨论串和状态；
- `thread_reply` 可用；
- 重启 DSH 后列表还在，能继续追加。

### M3 并行与隔离；M4 发布
- 按 Plan.md 原样，补充以下细节：
  - `maxRunning` 改为 3；
  - 改代码的讨论串在 `setup` 阶段调 `ctx.worktrees.create`。这个接口没有删除功能，要自己写清理命令 `/thread cleanup`（`git worktree remove`），只在你确认后执行。
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
