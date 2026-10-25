# dsh-threads Windows 实测（交给 Codex 的提示词）

把下面整段（从“你在一台 Windows 电脑上”开始）原样交给 Windows 电脑上的 Codex。它负责下载、安装、准备测试仓库和核对结果；界面上的点击由坐在电脑前的人来做，Codex 会一步步告诉他做什么。

需要提前准备：一个能登录 DeepSeek Harness 的 DeepSeek 账号（测试会用掉少量额度），D 盘至少 2 GB 空间。

---

你在一台 Windows 电脑上，帮我测试一个 DeepSeek Harness（简称 DSH）桌面版插件 dsh-threads 在 Windows 上能不能正常用。你负责下载、安装、准备测试数据、核对结果和写报告；DSH 的界面操作（点按钮、在对话框里输入）你做不了，由坐在电脑前的人（下面叫“操作者”）来做：每到需要点界面的地方，你把要做的事一条条写清楚，等他回复“好了”再继续。

## 规矩

- 所有文件都放在 `D:\dsh-test` 下；DSH 装到 `D:\DeepSeekHarness`。DSH 自己的数据目录（一般是 `%USERPROFILE%\.dsh`）由它自己管理，不要手动改里面的东西，只读。
- 不要输入、保存或打印任何密码、API Key。DeepSeek 账号由操作者在 DSH 界面里自己登录。
- 不要改系统设置（注册表、组策略、`LongPathsEnabled`、Defender 等），也不要全局改 git 配置；我们要测的就是 Windows 的默认情况。需要在测试仓库里设 git 用户名时，只用 `git -C <仓库> config user.name …`。
- 测试仓库都只在本地，不要 push 到任何地方。
- 删除 `D:\dsh-test` 以外的任何东西之前，先问操作者。
- 某一步失败了：把完整的报错原文、命令和输出记进报告，然后接着做后面不依赖它的步骤。不要去改插件源码或 DSH 的安装文件。
- 全程用 PowerShell。

## 第 0 步：环境

1. 记录：Windows 版本（`[Environment]::OSVersion`、`(Get-ComputerInfo).WindowsProductName`）、PowerShell 版本、D 盘剩余空间。
2. `git --version`。没有 git 时，问操作者能否安装 Git for Windows（`winget install --id Git.Git -e --source winget`），装好后重新打开 PowerShell 再确认。
3. 记录 `git config --global --get core.longpaths`、`git config --global --get core.autocrlf`（只读，不要改）。
4. 建目录：`New-Item -ItemType Directory -Force D:\dsh-test\downloads, D:\dsh-test\logs | Out-Null`。

## 第 1 步：下载并安装 DSH 0.2.1-rc.3 到 D 盘

1. 下载（约 276 MB）：
   ```powershell
   $exe = 'D:\dsh-test\downloads\deepseek-harness-0.2.1-rc.3-win-x64.exe'
   curl.exe -L --fail -o $exe 'https://download.deepseek.com/dsh-desk/bin/win-x64/deepseek-harness-0.2.1-rc.3-win-x64.exe'
   ```
2. 校验 SHA-512（官方更新源给的是 base64）：
   ```powershell
   $hex = (Get-FileHash -Algorithm SHA512 $exe).Hash
   $bytes = for ($i = 0; $i -lt $hex.Length; $i += 2) { [Convert]::ToByte($hex.Substring($i, 2), 16) }
   [Convert]::ToBase64String([byte[]]$bytes) -eq 'q5IGr2Bf+TvvCpagHj49Ypn/ZrqR7kqrYpLjqXP7VfDINmddlqZQmG+YfsdL3q3EdTRMRlKz/a3jDAEzdNdDOw=='
   ```
   不是 `True` 就停下来告诉操作者，不要安装。
3. 静默安装到 D 盘（NSIS 安装包，按用户安装，不需要管理员；`/D=` 必须是最后一个参数、不加引号）：
   ```powershell
   Start-Process -FilePath $exe -ArgumentList '/S', '/D=D:\DeepSeekHarness' -Wait
   Get-ChildItem D:\DeepSeekHarness -Filter *.exe | Select-Object Name
   ```
   如果 `D:\DeepSeekHarness` 下没有 `DeepSeek Harness.exe`：改成不加参数运行安装包，请操作者在安装界面里把目录选成 `D:\DeepSeekHarness`；再不行就装到默认位置，并把实际路径记进报告。
4. 找到 DSH 自带的命令行（插件靠它安装），记为 `$dsh`：
   ```powershell
   Get-ChildItem D:\DeepSeekHarness -Recurse -Include dsh, dsh.cmd, dsh.exe, dsh.ps1 -ErrorAction SilentlyContinue | Select-Object FullName
   ```
   一般在 `resources\runtime\cli\bin` 下。找不到时，请操作者打开 DSH，在应用菜单里找“管理 dsh 命令…”，照提示装好后用 `Get-Command dsh` 找。
5. 请操作者：打开 DeepSeek Harness，用自己的 DeepSeek 账号登录，随便发一句“你好”确认能回复；然后**完全退出** DSH（右下角托盘图标里也要退出）。你用 `Get-Process | Where-Object ProcessName -like '*DeepSeek*'` 确认没有残留进程。

## 第 2 步：安装插件 dsh-threads 0.1.0-rc.6

1. DSH 完全退出后执行，完整输出存到 `D:\dsh-test\logs\plugin-add.txt`：
   ```powershell
   & $dsh plugin --profile desktop add 'https://github.com/Kyf-eng/dsh-threads/releases/download/v0.1.0-rc.6/fky-dsh-threads-0.1.0-rc.6.tgz' *>&1 | Tee-Object D:\dsh-test\logs\plugin-add.txt
   ```
   失败的话再试 `& $dsh plugin --profile desktop add 'github:Kyf-eng/dsh-threads#v0.1.0-rc.6'`，两次的输出都记下来。
2. 找到 DSH 的数据目录（含 `profiles\desktop\package.json` 的那个 `.dsh`，一般是 `%USERPROFILE%\.dsh`），记为 `$dshHome`，确认 `profiles\desktop\package.json` 里有 `@fky/dsh-threads`。
3. 请操作者打开 DSH，确认：左侧导航里有“项目”入口；导航下面有一个“项目”分组（带“+”）。截图存到 `D:\dsh-test\logs\01-sidebar.png`（操作者截图后告诉你文件名，或你用 PowerShell 截屏也行）。

## 第 3 步：准备测试仓库

每个仓库都先 `git init -b main`，再在仓库里设 `user.name = dsh-test`、`user.email = dsh-test@example.com`，提交一次初始文件。

1. **普通仓库** `D:\dsh-test\playground`：`README.md`（一句介绍）、`src\app.js`（十几行代码）、`src\util.js`、`docs\notes.md`，提交。
   然后**在提交之后**加一个会失败的 hook，用来测插件是否关掉了仓库 hook：
   ```powershell
   Set-Content -Encoding ascii D:\dsh-test\playground\.git\hooks\pre-commit "#!/bin/sh`necho ran > hook-ran.txt`nexit 1`n"
   ```
2. **长路径仓库**：根目录长度约 170 个字符，比如 `D:\dsh-test\deep\` 下面套四层各 38 个字符的目录（`aaaaaaaa…`、`bbbbbbbb…` 等）。里面提交一个相对路径约 55 个字符的文件，比如 `docs\a-rather-long-file-name-for-the-path-check-01.md`。这样它在 worktree 里的完整路径会超过 260。记下根目录的实际长度。
3. **子目录仓库** `D:\dsh-test\mono`：`packages\app\index.js`、`packages\app\README.md`、根目录 `package.json`，提交。这个仓库的项目文件夹选 `D:\dsh-test\mono\packages\app`。

## 第 4 步：测试

每项都按“请操作者做 → 你核对 → 记结果”走。核对时主要看三样：
- 插件的存储 `$dshHome\storages\dsh_threads.json`（JSON，`tables.threads` 里每个讨论串有 `n`、`status`、`lastReport`、`worktree.path`、`worktree.branch`、`archived` 等）；
- git 状态（`git -C <仓库> status`、`worktree list`、`branch -a`、`log --oneline --all -5`）；
- 操作者看到的界面（请他描述或截图）。

“讨论串”是插件开出来的后台会话。项目主对话里的命令以 `/thread` 开头，要在输入框里输入后回车。

1. **新建项目**：左侧“项目”分组的“+” → 名字填 `playground` → “选择文件夹…”选 `D:\dsh-test\playground` → 新建项目。期望：打开这个项目的主对话；侧栏“项目”分组出现 playground；项目设置里显示的文件夹路径正确（反斜杠、盘符）。
2. **普通讨论串**：主对话输入 `/thread 列出这个仓库的文件，每个文件一句话说明用途`。期望：马上出现“已开讨论串 #1”；过一会儿主对话里出现“讨论串回报”卡片，主对话自动接着回复一次。核对：存储里 #1 的 `status` 为 `idle`、`lastReport.status` 为 `done`。
3. **worktree 讨论串 + 关闭 hook**：输入 `/thread -w 在 docs 下新建 windows.md，写一行 hello windows，然后提交到你的分支`。期望：讨论串在自己的 worktree 里提交成功。核对：
   - `git -C D:\dsh-test\playground worktree list` 里有 `.agents/worktrees/dsh-threads-2-…`；分支 `dsh-threads/2-…` 上有这次提交，`docs\windows.md` 只在分支上；
   - 项目文件夹 `git status` 干净；仓库根目录和 worktree 里都**没有** `hook-ran.txt`（有就说明插件关不掉 Windows 上的 hook，也看讨论串是否报了提交失败）；
   - 存储里 #2 的 `worktree.path`、`repositoryRoot` 原样抄进报告（看是不是正反斜杠混用），并确认这个路径用 `Test-Path` 能访问。
4. **清理 worktree**：主对话输入 `/thread cleanup`，再输入 `/thread cleanup confirm`。期望：第一条只列出、不删除；第二条删掉 #2 的 worktree，分支因为没合并而保留。核对 `worktree list` 和目录是否还在。
5. **文件被占用时清理**：再开一个 `/thread -w 在 docs 下新建 lock.md，写一行 lock，然后提交到你的分支`，等它回报。然后在另一个 PowerShell 窗口里 `Set-Location` 进这个 worktree 目录并保持窗口打开，同时请操作者用记事本打开里面的 `docs\lock.md`。这时输入 `/thread cleanup confirm`。记下插件的回复原文和目录是否还在。关掉记事本和那个 PowerShell 后再 `/thread cleanup confirm` 一次，记下结果。
6. **长路径**：用长路径仓库的根目录新建项目 `deep`，在它的主对话输入 `/thread -w 在 docs 下新建 check.md，写一行 ok，然后提交到你的分支`。记下成功与否；失败时记下回复和讨论串里的报错原文（多半和 260 字符限制、`core.longpaths` 有关）。
7. **子目录项目**：用 `D:\dsh-test\mono\packages\app` 新建项目 `mono`，输入 `/thread -w 在当前项目文件夹里新建 hello.txt，写一行 hi，然后提交到你的分支`。期望：文件出现在 worktree 的 `packages\app\hello.txt`，而不是 worktree 根目录。核对分支上的文件路径。
8. **审批模式沿用**：回到 playground 主对话，把输入框左下角的权限选成“仅可查看”。输入 `/thread -w 在 docs 下新建 approval.md，写一行 hi，然后提交到你的分支`。期望：讨论串要写文件时弹出审批（“允许 / 拒绝”），**不会自动通过**；右侧“讨论串”面板里它出现在“等待您处理”，写着“等你批准一项操作”；左侧 playground 这一行显示举手。请操作者点“拒绝”。最后把主对话的权限改回原来的模式。
9. **停止**：输入 `/thread 在终端里等待 90 秒（例如 Start-Sleep 90），然后回报 done`。请操作者点主对话标题栏的“讨论串”按钮打开右侧面板，点这个讨论串，再点面板头的“停止”。期望：讨论串显示“已停止”，之后**不会**自己又开始干活；主对话不会被唤醒。等 1 分钟确认。
10. **归档**：在讨论串面板头点归档图标归档 #1。期望：它从列表消失，列表底部出现“已归档 · 1”；再打开它点“取消归档”，回到列表。
11. **桌面通知**：在项目页（左侧导航“项目”）playground 卡片的“⋮”菜单 → 通知 → 选“所有新消息”。输入 `/thread 用一句话总结 README.md`，然后马上切到别的窗口（DSH 不要在前台）。期望：讨论串或主对话做完时，Windows 右下角弹出 DeepSeek Harness 的通知。没有弹出时，请操作者看一下 Windows“设置 → 系统 → 通知”里 DeepSeek Harness 是否允许通知，记下来。
12. **完整流程**：在 playground 主对话里发一条不提“讨论串”的消息：“帮我做三件事：① 把 README.md 第一行改成‘# Playground on Windows’；② 写一份 docs/usage.md，介绍 src 里两个文件怎么用；③ 看看 src/app.js 有没有可以简化的地方，列个清单给我就行。”它开始干活后，马上再发一条：“另外，把 docs/notes.md 的标题改成‘Notes’。”记下：主对话有没有为第②件开讨论串；第二条消息隔了多久得到处理；主对话有没有自己 `git commit` 或合并分支（它应该先问）；讨论串回报后它说了什么。核对 `git log --oneline --all` 和 `git status`。
13. **界面语言**：在 DSH 设置里把界面语言改成 English，在主对话输入 `/thread stop 99`。期望：回复是英文（“This main conversation has no thread #99.”）。再改回中文。

## 第 5 步：报告

写 `D:\dsh-test\report.md`，包括：

1. 环境：Windows 版本、PowerShell 版本、git 版本和 `core.longpaths` / `core.autocrlf`、DSH 安装路径和版本、`$dsh` 路径、`$dshHome` 路径、插件安装输出。
2. 一张表：每个测试一行，列为“编号 | 结果（通过 / 失败 / 部分通过）| 现象 | 证据”。证据写命令输出的关键几行、截图文件名或操作者的描述。
3. 失败或可疑的地方，单独一节，写完整报错原文和复现步骤。
4. 附件：把 `$dshHome\storages\dsh_threads.json` 复制到 `D:\dsh-test\logs\`；如果能找到 DSH 的日志目录（在 `$dshHome` 或 `%APPDATA%` 下找名字含 `log` 的目录），把最近的日志也复制过去。

最后把整个 `D:\dsh-test\logs` 和 `report.md` 打包成 `D:\dsh-test\dsh-threads-windows-report.zip`，告诉操作者文件位置。不要卸载 DSH，也不要删测试目录，等操作者决定。
