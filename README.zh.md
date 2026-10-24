# dsh-threads

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，照着 Claude 的"项目 + 讨论串"做。项目的主对话当调度员：遇到能独立完成的任务，就开一个**讨论串**——一个你能点进去接着聊的真实会话；讨论串做完后，把简短的回报发回主对话。

> 状态：**0.1.0-rc.3**，预发布版。基于 DeepSeek Harness 0.2.1-rc.2 开发和测试。更新记录见 [CHANGELOG.md](CHANGELOG.md)，设计说明见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。

## 功能

- **项目**：一个文件夹 + 一个常驻主对话，有图标、给协调者的目标，以及所有讨论串也会收到的项目说明。在左侧"项目"里新建（用系统的文件夹选择器选文件夹），或者在会话的"…"菜单里选"设为项目"。卡片的"⋮"菜单可以置顶、归档、删除、设置这个项目的桌面通知，以及打开项目设置（协调器和讨论串的模型、使用情况）。
- **讨论串**：主对话为能独立完成的工作开讨论串、给讨论串追加指令，也会提出你没要求的建议（放在输入框上方的卡片里，你点了才开始）。每个讨论串都是真实会话：在右侧面板打开，直接和它对话。
- **回报**：讨论串回报做完了什么、改了哪些文件、要你决定什么。主对话只在它的讨论串都结束后被唤醒一次，并防止反复唤醒；忘了回报的讨论串会被提醒一次。
- **并行和隔离**：最多 3 个讨论串同时运行。会改文件的讨论串在自己的 git worktree 和分支（`dsh-threads/<n>-<id>`）里工作，不碰项目文件夹；你要求时主对话才合并，`/thread cleanup` 清理做完的 worktree。
- **Claude 式界面**：对话里的讨论串卡片、"↳ N 条回复"、等你回复时的举手、运行中的呼吸点、文件和分支小标签。左侧有单独的"项目"分组：每个项目一行（显示状态和 ↳N），点进去就是主对话。项目的主对话和讨论串都不出现在"工作区"列表里。

## 安装

需要 DeepSeek Harness **0.2.1-rc.2**（桌面版或 Web 版）和它的 `dsh` 命令行。桌面版在应用菜单的"管理 dsh 命令…"里设置。

1. 完全退出 DeepSeek Harness。
2. 把插件加到你的 profile：

   ```sh
   dsh plugin --profile desktop add https://github.com/Kyf-eng/dsh-threads/releases/download/v0.1.0-rc.3/fky-dsh-threads-0.1.0-rc.3.tgz
   ```

   Web 版用 `--profile web`。也可以用 `github:Kyf-eng/dsh-threads#v0.1.0-rc.3`。
3. 启动 DeepSeek Harness，左侧出现"项目"。

卸载：`dsh plugin --profile desktop remove @fky/dsh-threads`。

## 使用

1. **项目 → 新建项目**：起名，选一个文件夹（任意文件夹，还不是工作区的会自动添加）。
2. 在项目主对话里让它在后台做事（"开个讨论串去……"）。也可以输入 `/thread <任务>`，或 `/thread -w <任务>` 开一个有独立 worktree 的讨论串。
3. 点讨论串卡片，在右侧打开它，可以直接聊；做完了点"标记已解决"。
4. 模型提出建议时，在输入框上方的卡片里开始一个、全部开始或都不要。
5. worktree 讨论串的改动在它自己的分支上。自己合并或让主对话合并，然后 `/thread cleanup`（再 `/thread cleanup confirm`）。

## 配置

在 profile 的 `cordis.patch.yml`（桌面版是 `~/.dsh/profiles/desktop/cordis.patch.yml`）里给插件加 `config`：

```yaml
- id: dsh-threads
  config:
    maxRunning: 2
```

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `maxRunning` | 3 | 一个主对话同时能跑几个讨论串 |
| `maxAutoWakes` | 5 | 连续自动唤醒几次后，回报改为等你开口（0 表示从不自动唤醒） |
| `noteMaxChars` | 400 | 发回主对话的回报最长多少字 |
| `summaryMaxChars` | 300 | 讨论串摘要最长多少字 |
| `proposalTtlDays` | 7 | 没开始的建议几天后过期 |
| `maxProposalsPerTurn` | 3 | 模型一次最多提几个建议 |
| `reportReminder` | true | 讨论串做完任务却没回报时，提醒它一次 |
| `inheritPermissionPreset` | true | 讨论串沿用主对话的权限模式 |

## 已知限制

- DeepSeek Harness 每个工作区默认只列 5 个会话，隐藏的讨论串也算在里面，所以讨论串多的工作区里可见的行会变少，"展开其余 N 个会话"的 N 也包含讨论串。
- worktree 从文件夹最后一次提交开出：没提交的改动不在里面，依赖（`node_modules` 等）要在 worktree 里重新装。
- "讨论串沿用主对话的审批模式"目前只在改过的本机安装上验证过，还没在官方原版上验证。

## 开发

需要 Node ≥ 22.19。

```sh
npm install
npm run check
# 完全退出 DeepSeek Harness 后：
npm run dev:install
```

## 协议

MIT
