# dsh-threads v0.1.0 正式发布计划

依据：《dsh-threads 正式发布差距清单》+ 对 `main` @ `69ec02e`（v0.1.0-rc.5）的代码复查，2026-10-24。

## 一、清单核对

本地重跑 `npm run check`：类型检查、测试、构建全过，构建后 `dist/` 和提交的一致。清单的大部分说法属实，下面几条要修正或补充：

| 清单条目 | 核对结果 |
| --- | --- |
| P0-2 peer 精确锁 `0.2.1-rc.2`，`engines.dsh` 是范围 | 属实（`package.json`）。补充：`>=0.2.1-rc.2 <0.3.0` 这种范围匹配不到 `0.2.2-rc.x` 之类的预发布版，DSH 发 rc 时还会报警。 |
| 跨平台 P0-2 CI 加 Windows/macOS | 属实。补充：`main` 的分支保护把 `check (node 22.19)`、`check (node 24)` 设成了必需检查；矩阵加 `os` 后任务名会变，**要同时改分支保护**，否则所有 PR 都会卡在“等待检查”。 |
| 跨平台 P1-3 Windows 上路径会正反斜杠混用 | **不成立**：`path.join` 在 Windows 上会把分隔符统一成 `\`（实测 `path.win32.join('C:/x/y', '.agents', …)` → `C:\x\y\.agents\…`）。真正要测的是另外三点：`core.hooksPath=/dev/null`、260 字符路径上限、文件被占用时 `worktree remove` 失败。 |
| P1-6 npm 作用域 `fky` | 查不到：npm 没登录，registry 上也没有 maintainer 为 `fky` 的包。要你登录 npm 后确认，或者改用你自己的 npm 用户名作作用域。改名只动 `package.json`、`cordis.patch.yml` 和 README 的安装地址。 |
| 跨平台 P1-6 手输路径的示例是 macOS 路径 | 属实（`src/projects.ts:155`）。 |
| Plan.md 里的仓库开关 | 已做：secret scanning、push protection 已开；话题 `dsh-plugin` / `deepseek-harness` / `dsh` 都在；`main` 有保护。 |

## 二、复查发现的遗漏（清单里没有）

### A. 缺陷：发布前要修

1. **删除项目后，讨论串就找不到了。** 删除确认框写的是“主对话和讨论串会保留为普通会话”，但：
   - `sessions.kinds` 返回**所有**讨论串记录（`src/api.ts:164`），浏览器端照旧用 CSS 把它们从 DSH 的会话列表里藏起来；
   - `roleOf` 只看讨论串记录在不在（`src/roles.ts:10`），这些会话还会继续装 `thread_report` 和讨论串提示。

   结果是讨论串既不在项目里，也不在会话列表里，只有重新把原来的主对话“设为项目”才能找回来。修法：只隐藏属于现存项目的讨论串，不属于项目的讨论串角色算 `none`；或者删除时把讨论串标为“已脱离”。补测试。
2. **主对话没加载时，审批继承会静默跳过。** `host.inheritPermission` 只用 `ctx.agents.get` 拿已加载的主对话（`src/host.ts:162`）。排队的提议在 DSH 重启后由 `recover()` 启动、或者主对话已被卸载时，这一步什么也不做，讨论串就用**用户默认**的审批模式，可能比主对话更宽。`permissionPresets` 服务不在时也是这样。修法：用 `resolveAgent` 取主对话；还是取不到就不开串（或者用最严格的模式）并记一条 warn。和 P0-1 的原版验证放在一起做。
3. **项目文件夹是仓库的子目录时，worktree 讨论串会进错目录。** worktree 从仓库根检出（`src/worktree.ts:52`），`enterDirectory` 直接进 worktree 根（`src/manager.ts:191`）。monorepo 里项目是 `repo/packages/app` 时，讨论串会在 `<worktree>/` 而不是 `<worktree>/packages/app` 下工作，简报里的相对路径全部对不上。修法：算出项目文件夹相对仓库根的路径，进 worktree 里的对应子目录；讨论串提示也写这个子目录。补一个子目录的 worktree 测试。
4. **宿主端的文案只有中文。** 浏览器端有中英两套，README 也以英文为主，但用户能直接看到的这些只有中文：
   - `offer` 弹出的选择卡：“要为「…」开一个讨论串吗？”和三个选项（`src/tools/thread-open.ts:80`）；
   - `/thread` 的所有输出和用法（`src/command.ts:5`）；
   - `ProjectError`，界面上原样显示（“项目名不能为空”“还有讨论串在运行，等它们结束再归档”等）；
   - 简报、追加、提醒卡片的正文。

   修法：宿主端也按 DSH 的语言出这些文案。只给模型看的工具返回值可以统一改成英文（系统提示本来就是英文）。
5. **README 漏了一条 IMPLEMENTATION.md 明确要求发布时写上的说明**：开着“开发者工具”（实验性检查器）时，DSH 可能报 `source state exceeds the source-frame byte limit` 崩溃，这时调大 `maxSourceFrameBytes` 就能规避，不要点“禁用第三方插件”（IMPLEMENTATION.md §二 M0）。

### B. 功能缺口：建议 v0.1.0 前补上，或者写进已知限制

6. **讨论串不能停止。** IMPLEMENTATION.md §三 计划了 `/thread stop <n>`、`/thread list`、`/thread start <n>` 和 RPC `stop`，一个都没做，主对话也没有停讨论串的工具。现在只能点进讨论串，用 DSH 自带的停止（内嵌输入框里有没有停止按钮还没验证）。而归档项目要求所有讨论串都已停止，用户只能一个个点进去停。建议：讨论串面板头加“停止”，加 `/thread stop <n>`；`thread_stop` 工具可以等以后。
7. **单个讨论串不能归档或删除。** 讨论串从 DSH 的列表里藏起来以后，DSH 自己的会话菜单也就用不了了，“标记已解决”是唯一的收尾方式。项目用得越久，讨论串列表越长。建议：面板和列表里加“归档”（走 `workspaceRegistry.archiveSession`），列表默认收起已归档的。
8. **worktree 清理只有命令能做**（P2）。`/thread cleanup` 在界面上没有入口。建议在面板头的分支标签旁边加“删除 worktree”。
9. **存储只增不减**（P2）。过期、已开始、已忽略的提议，删除项目后留下的讨论串和 `mains` 记录，都不会被清理。量不大，可以在启动时清掉 30 天前已经结束的提议。
10. **主对话被删掉以后**（P2），项目还指向这个会话，点开是空的。建议打开失败时提示，并给出“删除项目”的选项。
11. **花费上限**（P2）。Plan.md 设计要点 5 写的是“限制并发和花费”，现在只做了并发上限和用量展示。正式版把这条写进已知限制就够了。
12. **依赖了 DSH 的非公开行为，要单独列出来。** 侧栏靠 `data-row-key` DOM 属性隐藏行，“项目”分组用 portal 插在 `<nav>` 后面，文件夹选择器用的是 `__DSH_DIRECTORY_PICKER__`，`selectModel` 改默认模型的副作用要手动改回去。这些都不是公开接口，DSH 一升级最先坏的就是它们。建议在 IMPLEMENTATION.md 列一张“依赖的 DSH 内部行为”表，再配一份升级冒烟清单，和 P0-2 一起做。

## 三、要你拍板的事

| # | 问题 | 建议 |
| --- | --- | --- |
| D1 | peer 版本：现在放宽，还是等 DSH 0.2.1 正式版？ | **现在就放宽**到 `>=0.2.1-rc.2 <0.3.0`，和 `engines.dsh` 保持一致，不必等 DSH 的发布节奏。DSH 正式版出来后照冒烟清单走一遍，有问题就发 0.1.1。 |
| D2 | B6、B7（停止、归档单个讨论串）放进 v0.1.0 吗？ | **放进去**。归档项目要求先停讨论串，而讨论串又没法收尾，两件事都小。 |
| D3 | A4（宿主端文案双语）放进 v0.1.0 吗？ | **放进去**，只做用户能看到的部分；README 以英文为主，英文用户第一眼就会看到中文。 |
| D4 | Windows 支持到什么程度？ | 先确认 DSH 桌面版有没有 Windows 和 Linux 的安装包。没有的话，正式版写“macOS（桌面版）、Linux 和 Windows（Web 版）”；Windows 没在真机上跑过之前，标成“未验证”。 |
| D5 | npm 作用域 | 你登录 npm 后确认 `fky`；不是你的就换成你的用户名。 |

## 四、分阶段计划

### 阶段 0：冻结功能（从现在开始）
`main` 只收修复、测试、文档和 CI；B6、B7 是 D2 同意后唯一新增的功能。

### 阶段 1：修复和测试（我来做，每个 PR 一件事，CI 变绿后合并）

| PR | 内容 | 对应 |
| --- | --- | --- |
| `fix/orphaned-threads` | 删除项目后讨论串回到会话列表、不再装讨论串工具；补测试 | A1 |
| `fix/inherit-permission` | 用 `resolveAgent` 取主对话，取不到就拒绝开串；补测试 | A2 |
| `fix/worktree-subfolder` | 子目录项目的 worktree 讨论串进对应子目录；补测试 | A3 |
| `test/tools-command-storage` | 五个 `thread_*` 工具的参数和返回值；`/thread` 的 `-w`、`cleanup`、`cleanup confirm`、非项目会话被拒；`roleOf` 和 install；用 rc.1 格式的旧记录读回 storage schema | 清单 P1-4 |
| `feat/thread-stop-archive` | 面板头加“停止”“归档”，`/thread stop <n>`，列表收起已归档的 | B6、B7（D2） |
| `fix/host-locale` | 宿主端用户能看到的文案做成中英双语 | A4（D3） |
| `ci/cross-platform` | `.gitattributes`（`* text=auto eol=lf`）；CI 加 `windows-latest`、`macos-latest`，同时改分支保护的必需检查；加 `npm pack --dry-run` 检查；peer 放宽；路径示例按平台显示 | 清单跨平台 P0-2、P1-4，P0-2（D1），P2-11 |
| `ci/release` | 打 tag 时触发：检查 tag、`package.json` 版本、CHANGELOG 标题、README 安装地址四者一致，然后构建、`npm pack`，附到 GitHub Release | 清单 P1-5 |
| `docs/release-readiness` | README：检查器崩溃的规避办法、各平台的 `dsh` 命令位置和怎样彻底退出、各平台的通知说明、B9 和 B11 写进已知限制；`dev-install` 支持用 `DSH_CLI` 指定路径并在 README 写明；IMPLEMENTATION.md 加“依赖的 DSH 内部行为”表和升级冒烟清单；`SECURITY.md`、`CONTRIBUTING.md`、issue 模板 | A5、B12，清单跨平台 P1-5、P2-7、P2-8，P2-8 |

B8、B9、B10 是 P2，时间够就做，不够就留到 0.1.x。

### 阶段 2：需要你亲自做的验证（可以和阶段 1 同时进行）
1. **在原版 DSH 上验证审批继承**（清单 P0-1）：我先准备好 `~/dsh-clean`、装好 `.tgz` 并启动 `dsh web`，你在网页里登录模型账号，再按 IMPLEMENTATION.md §六 第 8 条走一遍（主对话设成 ask，让讨论串写文件，必须弹审批）。A2 修好以后再测一次“排队的提议在重启后启动”这条路径。结论写进 IMPLEMENTATION.md，并从 README 删掉这条限制。
2. **跨平台实装**（清单跨平台 P0-1）：确认 DSH 支持哪些平台（D4）。Linux 我可以在容器里跑 `dsh web` 走一遍；Windows 要一台真机或虚拟机：新建项目、开讨论串、开 worktree 讨论串、`/thread cleanup confirm`。
3. **npm 作用域**（D5）。

### 阶段 3：v0.1.0-rc.6，同时演练自动发布
- 阶段 1 合并完、阶段 2 的第 1 项通过以后，打 `v0.1.0-rc.6`，让 release workflow 自动出 Release。
- 照惯例在 test1 里做一次完整流程测试：不提“讨论串”，一次给几件事，开串后马上再提新需求，等回报回来。再加测删除项目、停止和归档讨论串。
- **试用期 3–5 天**：只修 bug，每个修复都发 rc.7、rc.8……

### 阶段 4：v0.1.0
- README（中英）：去掉“Status: pre-release”，安装地址改成 `v0.1.0`，加一段“从 rc 升级”（存储兼容，直接 `dsh plugin add` 新版本就行，不用先删插件；这一点由阶段 1 的旧记录测试保证）。CHANGELOG 加 `0.1.0` 一节，汇总 rc.1–rc.N。
- 打 `v0.1.0` 标签，由 workflow 发布。
- 以下几项都是对外操作，**每一项做之前都先问你**：`npm publish --access public`、向 awesome-dsh-plugin 提交 PR、README 加截图或 GIF（清单 P2-10，可以放在这之前做）。

## 五、进度（2026-10-25）

阶段 1 全部完成，按 D1–D3 的建议做的，每个 PR 都在 CI 变绿后合并：

| PR | 内容 |
| --- | --- |
| [#22](https://github.com/Kyf-eng/dsh-threads/pull/22) | A1 删除项目后讨论串回到会话列表 |
| [#23](https://github.com/Kyf-eng/dsh-threads/pull/23) | A2 审批继承取不到主对话就不开串（顺带：主对话是 `custom` 模式时原来会留下一个失败的讨论串） |
| [#24](https://github.com/Kyf-eng/dsh-threads/pull/24) | A3 子目录项目的 worktree 讨论串进对应子目录 |
| [#25](https://github.com/Kyf-eng/dsh-threads/pull/25) | 清单 P1-4 工具、命令、按角色安装、旧存储记录的测试 |
| [#26](https://github.com/Kyf-eng/dsh-threads/pull/26) | B6、B7 停止和归档单个讨论串（顺带：DSH 自带的停止按钮会让讨论串被“提醒回报”叫醒；讨论串列表不能滚动）。桌面版实测 |
| [#27](https://github.com/Kyf-eng/dsh-threads/pull/27) | A4 宿主端文案中英双语，跟随页面语言；清单跨平台 P1-6 路径示例。桌面版实测 |
| [#28](https://github.com/Kyf-eng/dsh-threads/pull/28) | 跨平台 CI（Windows、macOS 首次运行即通过）、`.gitattributes`、打包检查、peer 放宽（D1） |
| [#29](https://github.com/Kyf-eng/dsh-threads/pull/29) | 清单 P1-5 打 tag 自动发布 |
| docs/release-readiness | A5 检查器崩溃的说明、B12 DSH 内部依赖表和升级冒烟清单（IMPLEMENTATION.md §七）；清单跨平台 P1-5、P2-7、P2-8（`dev:install` 的 `DSH_CLI`、各平台安装和退出、通知设置）；清单 P2-8（SECURITY / CONTRIBUTING / issue 模板）；把本计划提交进仓库 |

阶段 1 中新发现、要带进阶段 2 的事：

- **DSH `0.2.1-rc.3`**（2026-10-23 发布）：本机桌面版已升级，冒烟清单的主要项目通过；peer 范围已经覆盖 rc.3。
- **SECURITY.md 指向 GitHub 的私下报告漏洞**，这个仓库还没开（Settings → Code security → Private vulnerability reporting）。这是仓库设置，要你决定是否打开。
- Windows 和 macOS 的 CI 任务暂时不是必需检查；要设成必需，需要改 `main` 的分支保护（仓库设置）。
- B8（worktree 清理的界面入口）、B9（存储清理）、B10（主对话被删）没做，留在 0.1.x；B11（花费上限）写进了已知限制。
- 审批继承（清单 P0-1）已在桌面版 0.2.1-rc.3 原版宿主上验证通过（IMPLEMENTATION.md“DSH 0.2.1-rc.3 上的冒烟测试和审批验证”）。Linux 暂时没有机器；Windows 由朋友的 Codex 按 `docs/WINDOWS-TEST.md` 安装 DSH 0.2.1-rc.3（Windows x64 桌面版）和 v0.1.0-rc.6 后实测。v0.1.0-rc.6 已由打 tag 的 workflow 自动发布。
- README 默认改成中文：`README.md` 是中文，英文移到 `README.en.md`。发布检查（`scripts/release.ts`）、打包清单和 Release 说明里的链接跟着改。
- 安全报告：仓库已打开私下报告漏洞（Private vulnerability reporting），和 `SECURITY.md` 的说法一致。
- npm 作用域（D5）：`fky` 在 npm 上是别人的组织，包名改成 `@kyf-eng/dsh-threads`（你的 npm 用户名，和 GitHub 一致）。从 rc.6 及更早版本升级要先卸载 `@fky/dsh-threads`，README 写了步骤；**下一个版本的 CHANGELOG 要写上改名和升级步骤**。`npm publish` 仍等正式版时再问你。
- Windows 实测第一轮（rc.6）：做完了 1–4 项的全部或一部分。找到两个插件问题：找不到 git 时误报“不是 git 仓库”（#37）；讨论串用 `--no-verify` 绕过 hook、主对话自己改系统权限（#38）。另外测试文档写错了 hook 那一项。详见 IMPLEMENTATION.md“Windows 实测第一轮”。docs/WINDOWS-TEST.md 加了第二轮的提示词：先升级到 rc.7，再补测剩下的项目。
- v0.1.0-rc.7：#35–#39（中文 README、包名 `@kyf-eng/dsh-threads`、找不到 git 的提示、不绕过检查）。#38 在 macOS 上实测通过。Windows 第二轮按 docs/WINDOWS-TEST.md 的第二轮提示词，从升级到 rc.7 开始测。
- Windows 实测第二轮（rc.7）：13 项里通过 8 项，部分通过 3 项，失败 1 项（长路径），未执行 1 项（界面语言）。修了三处：检出失败时收回分支、说明长路径（#41）；主对话也接受用户本人的明确同意（#42）；`/thread` 那一行下面加讨论串卡片，新项目第一条 `/thread` 不再停在欢迎页（#43）。#42、#43 在 macOS 上实测通过。
- v0.1.0-rc.8：#41–#44（检出失败时收回分支并说明长路径、主对话接受用户本人的明确同意、`/thread` 那一行下面的讨论串卡片、第二轮测试记录）。
