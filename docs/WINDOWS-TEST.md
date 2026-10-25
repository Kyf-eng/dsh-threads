# dsh-threads Windows 实测（交给 Codex 的提示词）

两段提示词，都是原样交给 Windows 电脑上的 Codex。Codex 负责下载、安装、准备测试仓库和核对结果；界面上的点击由坐在电脑前的人来做，Codex 会一步步告诉他做什么。

- **第二轮**：在已经测过 0.1.0-rc.6 的那台电脑上接着测（上次的 `D:\dsh-test` 还在）。从“你之前在这台电脑上”开始复制。
- **第一轮**：在一台全新的电脑上从头测。从“你在一台 Windows 电脑上”开始复制。

需要提前准备：一个能登录 DeepSeek Harness 的 DeepSeek 账号（测试会用掉少量额度），D 盘至少 2 GB 空间。

## 第一轮的结果（0.1.0-rc.6，2026-10-25）

做完了 1–4 项的全部或一部分，5–13 项没做。

- 安装、新建项目、普通讨论串都正常。
- 开 worktree 时报“不是 git 仓库”：机器上只有 Codex 自带的 git，DSH 找不到 git。装上 Git for Windows 并重开 DSH 后正常。0.1.0-rc.7 起改成直接提示“找不到 git”。
- 讨论串提交时碰上会失败的 pre-commit hook，就用 `--no-verify` 绕过去了，还删掉了 hook 写的文件。插件只在自己调用 git（开、删 worktree）时关掉 hook，讨论串自己的提交本来就该走仓库的 hook。第一轮把这当成“插件关不掉 hook”来测，是测试写错了。0.1.0-rc.7 起要求讨论串遇到这种情况回报“受阻”，不要绕过；第二轮按改过的方法测。
- `SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\dsh-test\playground)`：DSH 的沙箱没能给项目文件夹加写权限。这是 DSH 自己的问题，可能和 `D:\dsh-test` 是 Codex 建的有关。主对话还试着自己修这个文件夹的权限，临时放开了 PowerShell 的脚本执行策略。0.1.0-rc.7 起，主对话遇到这种错误只告诉用户，不自己动系统设置。
- 同一条 `/thread` 命令每次都发了两到五遍，开出了重复的讨论串。操作者确认是发错了；不过第二轮发现，新项目的第一条 `/thread` 发出后界面会停在欢迎页，也容易让人以为没发出去（0.1.0-rc.8 起修好）。

## 第二轮的结果（0.1.0-rc.7，2026-10-25）

13 项里通过 8 项，部分通过 3 项，失败 1 项，未执行 1 项。详见 IMPLEMENTATION.md“Windows 实测第二轮”。

- 升级、清理、子目录项目、审批沿用、停止、归档、完整流程都正常；hook 按规则处理（讨论串在用户回了「同意」之后才跳过 hook）。
- 长路径失败：git 报 `Filename too long`，还留下一个分支。0.1.0-rc.8 起失败时收回分支，并说明怎样只为这个仓库打开长路径。
- 新项目的第一条 `/thread` 发出后界面停在欢迎页，像没反应。0.1.0-rc.8 起命令下面会出现讨论串卡片。
- 文件被占用时清理、Windows 通知只部分验证，界面语言没测完。终端命令的 `SetNamedSecurityInfoW (Win32 5)` 仍是 DSH 沙箱的问题。

---

你之前在这台电脑上测过 DeepSeek Harness（DSH）的插件 dsh-threads 0.1.0-rc.6：测试目录 `D:\dsh-test`，DSH 装在 `D:\DeepSeekHarness`，上次的报告在 `D:\dsh-test\report.md`。这一轮先把插件升级到 0.1.0-rc.7，再补测上次没做完的项目。你负责安装、准备、核对和写报告；DSH 的界面操作由坐在电脑前的人（下面叫“操作者”）来做：每到需要点界面的地方，你把要做的事一条条写清楚，等他回复“好了”再继续。

## 规矩

- 规矩和上次一样：文件只放在 `D:\dsh-test` 下；DSH 的数据目录 `%USERPROFILE%\.dsh` 只读；不输入、保存或打印任何密码和 API Key；不改系统设置（注册表、组策略、`LongPathsEnabled`、Defender、执行策略、文件夹权限 ACL），也不全局改 git 配置；测试仓库不 push；删 `D:\dsh-test` 以外的东西先问操作者；失败了就记下完整报错，再接着做不依赖它的步骤；全程用 PowerShell。
- **每条 `/thread` 命令只发一次。** 发完等主对话里出现以 `thread ·` 开头的回复行，或者一张讨论串卡片，再做下一步。10 秒内什么都没出现，就告诉你，不要重发。上次每条命令都发了两到五遍，开出了重复的讨论串。
- 讨论串编号接着上次往下排（上次到 #7），核对时以存储里的实际编号为准。
- 新的日志都放 `D:\dsh-test\logs\r2-*`，不要覆盖上次的文件。

## R0：环境复查

1. 用系统保存的 PATH（不是你自己运行环境的 PATH）找 git，记下路径和版本：
   ```powershell
   $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
   (Get-Command git).Source; git --version
   ```
   找不到就停下来告诉操作者：DSH 用的就是这个 PATH 里的 git。
2. 只读记录权限信息，存到 `D:\dsh-test\logs\r2-acl.txt`：`whoami`、`(Get-Acl D:\dsh-test).Owner`、`(Get-Acl D:\dsh-test\playground).Owner`、`icacls D:\dsh-test`、`icacls D:\dsh-test\playground`。**不要改任何权限。**

## R1：升级插件到 0.1.0-rc.7

包名从 `@fky/dsh-threads` 改成了 `@kyf-eng/dsh-threads`，新版本不会替换旧的，要先卸载旧的。

1. 请操作者**完全退出** DSH（托盘图标里也要退出）。用 `Get-Process | Where-Object ProcessName -like '*DeepSeek*'` 确认没有残留进程。
2. 用上次找到的 `$dsh`（`D:\DeepSeekHarness\resources\runtime\cli\bin\dsh.cmd`）执行：
   ```powershell
   & $dsh plugin --profile desktop remove @fky/dsh-threads *>&1 | Tee-Object D:\dsh-test\logs\r2-plugin-remove.txt
   & $dsh plugin --profile desktop add 'https://github.com/Kyf-eng/dsh-threads/releases/download/v0.1.0-rc.7/kyf-eng-dsh-threads-0.1.0-rc.7.tgz' *>&1 | Tee-Object D:\dsh-test\logs\r2-plugin-add.txt
   ```
3. 核对 `%USERPROFILE%\.dsh\profiles\desktop\package.json`：有 `@kyf-eng/dsh-threads`，没有 `@fky/dsh-threads`。
4. 请操作者打开 DSH。期望：左侧“项目”分组里 playground 和 deep 都还在；打开 playground 主对话，标题栏“讨论串”按钮打开的右侧面板里，上次的 #1–#7 都还在（数据存在 DSH 自己的存储里，改包名不会丢）。#7 上次停在“运行中”，现在应该已经不是运行中。

## R2：worktree 和仓库 hook（改过的第 3 项）

插件自己调用 git（开、删 worktree）时会关掉仓库的 hook；讨论串自己提交时，仓库的 hook 照常执行，碰上失败的 hook 应该回报“受阻”，不能用 `--no-verify` 绕过去。

1. 在 playground 加一个 post-checkout hook（开 worktree 时 git 会触发它；插件关掉了 hook 的话，它就不会执行）。上次那个会失败的 pre-commit hook 保留：
   ```powershell
   Set-Content -Encoding ascii D:\dsh-test\playground\.git\hooks\post-checkout "#!/bin/sh`necho ran > post-checkout-ran.txt`n"
   ```
2. 请操作者在 playground 主对话输入（只发一次）：`/thread -w 在 docs 下新建 hooks.md，写一行 hooks，然后提交到你的分支`
3. 等讨论串回报后核对：
   - 新 worktree（`git -C D:\dsh-test\playground worktree list` 里最新的那个）根目录里**没有** `post-checkout-ran.txt`。有的话，说明插件在 Windows 上关不掉自己那次 git 调用的 hook。
   - 讨论串回报的状态是 `blocked`（存储里 `lastReport.status`），摘要里提到 pre-commit hook 失败；它的分支上**没有**新提交；它**没有**用 `--no-verify`，也没删 worktree 里的 `hook-ran.txt`。请操作者打开这个讨论串，把它说的话截图存成 `r2-hook-report.png`。
   - 项目文件夹 `git status` 干净。
4. 存储里这个讨论串的 `worktree.path`、`worktree.repositoryRoot` 原样抄进报告，并用 `Test-Path` 确认路径能访问。

## R3：清理 worktree（第 4 项）

1. 请操作者输入 `/thread cleanup`。期望：只列出已结束讨论串的 worktree，不删除。抄下回复原文。
2. 再输入 `/thread cleanup confirm`。期望：干净的 worktree（上次 #6 的；#7 做完了的话也算）被删掉，分支因为没合并而保留；有未提交改动的 worktree（R2 那个）被跳过，回复里说明原因。核对 `worktree list`、`branch -a` 和目录是否还在。

## R4–R12：上次没做的项目

做法和上次报告里第 5–13 项的描述一样，下面写的是要点。

- **R4 文件被占用时清理**：开 `/thread -w 在 docs 下新建 lock.md，写一行 lock，然后提交到你的分支`。这个讨论串的提交也会被 pre-commit hook 挡住，回报“受阻”是对的，这一项只需要它的 worktree。等它回报后，在另一个 PowerShell 窗口里 `Set-Location` 进这个 worktree 并保持窗口打开，同时请操作者用记事本打开里面的 `docs\lock.md`。然后输入 `/thread cleanup confirm`，记下回复原文、目录还在不在。关掉记事本和那个窗口后再 `/thread cleanup confirm` 一次，记下结果。（这个 worktree 有未提交的文件，所以两次都应该被跳过；要的是回复里说明原因，而且不报错、不卡住。）
- **R5 长路径**：打开上次建好的项目 `deep` 的主对话，输入 `/thread -w 在 docs 下新建 check.md，写一行 ok，然后提交到你的分支`（deep 没有 hook，应该能提交）。记下成功与否；失败时记下回复和讨论串里的报错原文（多半和 260 字符限制、`core.longpaths` 有关）。
- **R6 子目录项目**：用 `D:\dsh-test\mono\packages\app` 新建项目 `mono`，输入 `/thread -w 在当前项目文件夹里新建 hello.txt，写一行 hi，然后提交到你的分支`。期望：分支上的文件是 `packages/app/hello.txt`，不在 worktree 根目录。
- **R7 审批模式沿用**：回到 playground 主对话，把输入框左下角的权限选成“仅可查看”。输入 `/thread 在 docs 下新建 approval.md，写一行 hi`（不开 worktree）。期望：讨论串要写文件时弹出审批（“允许 / 拒绝”），**不会自动通过**；右侧“讨论串”面板里它出现在“等待您处理”，写着“等你批准一项操作”；左侧 playground 这一行显示举手。请操作者点“拒绝”。最后把权限改回原来的模式，记下原来是哪个。
- **R8 停止**：输入 `/thread 在终端里等待 90 秒（例如 Start-Sleep 90），然后回报 done`。请操作者打开右侧“讨论串”面板，点这个讨论串，再点面板头的“停止”。期望：讨论串显示“已停止”，之后**不会**自己又开始干活，主对话也不会被唤醒。等 1 分钟确认。终端用不了（又报 `SetNamedSecurityInfoW`）的话，记下来，再改用一个要它多步阅读文件的任务来测停止。
- **R9 归档**：在讨论串面板头点归档图标，归档上次的 #1。期望：它从列表消失，列表底部出现“已归档 · 1”；再打开它点“取消归档”，它回到列表。
- **R10 桌面通知**：在项目页（左侧导航“项目”）playground 卡片的“⋮”菜单 → 通知 → 选“所有新消息”。输入 `/thread 用一句话总结 README.md`，然后马上切到别的窗口（DSH 不要在前台）。期望：做完时 Windows 右下角弹出 DeepSeek Harness 的通知。没有弹出的话，请操作者看 Windows“设置 → 系统 → 通知”里 DeepSeek Harness 是否允许通知，记下来。
- **R11 完整流程**：在 playground 主对话里发一条不提“讨论串”的消息：“帮我做三件事：① 把 README.md 第一行改成‘# Playground on Windows’；② 写一份 docs/usage.md，介绍 src 里两个文件怎么用；③ 看看 src/app.js 有没有可以简化的地方，列个清单给我就行。”它开始干活后，马上再发一条：“另外，把 docs/notes.md 的标题改成‘Notes’。”记下：主对话有没有为第②件开讨论串；第二条消息隔了多久得到处理；主对话有没有自己 `git commit`、合并分支或改权限（都应该先问）；碰上 hook 或权限错误时，它是告诉你还是自己去修；讨论串回报后它说了什么。核对 `git log --oneline --all` 和 `git status`。
- **R12 界面语言**：在 DSH 设置里把界面语言改成 English，在主对话输入 `/thread stop 99`。期望：回复是英文（“This main conversation has no thread #99.”）。再改回中文。

## R13：报告

写 `D:\dsh-test\report-r2.md`，格式和上次一样：环境复查结果（git 路径和版本、`r2-acl.txt` 的要点）、升级结果、一张“编号 | 结果（通过 / 失败 / 部分通过 / 未执行）| 现象 | 证据”的表、失败或可疑的地方（完整报错原文和复现步骤）。把 `%USERPROFILE%\.dsh\storages\dsh_threads.json` 复制成 `D:\dsh-test\logs\r2-dsh_threads.json`。最后把 `report-r2.md` 和 `D:\dsh-test\logs\r2-*` 打包成 `D:\dsh-test\dsh-threads-windows-report-r2.zip`，告诉操作者文件位置。不要卸载 DSH，也不要删测试目录。

---

你在一台 Windows 电脑上，帮我测试一个 DeepSeek Harness（简称 DSH）桌面版插件 dsh-threads 在 Windows 上能不能正常用。你负责下载、安装、准备测试数据、核对结果和写报告；DSH 的界面操作（点按钮、在对话框里输入）你做不了，由坐在电脑前的人（下面叫“操作者”）来做：每到需要点界面的地方，你把要做的事一条条写清楚，等他回复“好了”再继续。

## 规矩

- 所有文件都放在 `D:\dsh-test` 下；DSH 装到 `D:\DeepSeekHarness`。DSH 自己的数据目录（一般是 `%USERPROFILE%\.dsh`）由它自己管理，不要手动改里面的东西，只读。
- 不要输入、保存或打印任何密码、API Key。DeepSeek 账号由操作者在 DSH 界面里自己登录。
- 不要改系统设置（注册表、组策略、`LongPathsEnabled`、Defender、执行策略、文件夹权限 ACL 等），也不要全局改 git 配置；我们要测的就是 Windows 的默认情况。需要在测试仓库里设 git 用户名时，只用 `git -C <仓库> config user.name …`。
- 测试仓库都只在本地，不要 push 到任何地方。
- 删除 `D:\dsh-test` 以外的任何东西之前，先问操作者。
- 某一步失败了：把完整的报错原文、命令和输出记进报告，然后接着做后面不依赖它的步骤。不要去改插件源码或 DSH 的安装文件。
- **每条 `/thread` 命令只发一次**：发完等主对话里出现以 `thread ·` 开头的回复行，或者一张讨论串卡片，再做下一步；10 秒内什么都没出现，就告诉你，不要重发。讨论串编号以存储里的实际编号为准。
- 全程用 PowerShell。

## 第 0 步：环境

1. 记录：Windows 版本（`[Environment]::OSVersion`、`(Get-ComputerInfo).WindowsProductName`）、PowerShell 版本、D 盘剩余空间。
2. git：DSH 用的是**系统 PATH** 里的 git，你自己运行环境里带的 git 不算。用系统保存的 PATH 检查：
   ```powershell
   $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
   (Get-Command git -ErrorAction SilentlyContinue).Source
   ```
   没有输出，就问操作者能否安装 Git for Windows（`winget install --id Git.Git -e --source winget`，winget 不能用时从 https://git-scm.com/download/win 下载官方安装包），装好后再用上面的方法确认。
3. 记录 `git config --global --get core.longpaths`、`git config --global --get core.autocrlf`（只读，不要改）。
4. 建目录：`New-Item -ItemType Directory -Force D:\dsh-test\downloads, D:\dsh-test\logs | Out-Null`。

## 第 1 步：下载并安装 DSH 0.2.1-rc.3 到 D 盘

1. 下载（约 276 MB）：
   ```powershell
   $exe = 'D:\dsh-test\downloads\deepseek-harness-0.2.1-rc.3-win-x64.exe'
   curl.exe -L --fail -C - -o $exe 'https://download.deepseek.com/dsh-desk/bin/win-x64/deepseek-harness-0.2.1-rc.3-win-x64.exe'
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

## 第 2 步：安装插件 dsh-threads 0.1.0-rc.8

1. DSH 完全退出后执行，完整输出存到 `D:\dsh-test\logs\plugin-add.txt`：
   ```powershell
   & $dsh plugin --profile desktop add 'https://github.com/Kyf-eng/dsh-threads/releases/download/v0.1.0-rc.8/kyf-eng-dsh-threads-0.1.0-rc.8.tgz' *>&1 | Tee-Object D:\dsh-test\logs\plugin-add.txt
   ```
   失败的话再试 `& $dsh plugin --profile desktop add 'github:Kyf-eng/dsh-threads#v0.1.0-rc.8'`，两次的输出都记下来。
2. 找到 DSH 的数据目录（含 `profiles\desktop\package.json` 的那个 `.dsh`，一般是 `%USERPROFILE%\.dsh`），记为 `$dshHome`，确认 `profiles\desktop\package.json` 里有 `@kyf-eng/dsh-threads`。
3. 请操作者打开 DSH，确认：左侧导航里有“项目”入口；导航下面有一个“项目”分组（带“+”）。截图存到 `D:\dsh-test\logs\01-sidebar.png`（操作者截图后告诉你文件名，或你用 PowerShell 截屏也行）。

## 第 3 步：准备测试仓库

每个仓库都先 `git init -b main`，再在仓库里设 `user.name = dsh-test`、`user.email = dsh-test@example.com`，提交一次初始文件。

1. **普通仓库** `D:\dsh-test\playground`：`README.md`（一句介绍）、`src\app.js`（十几行代码）、`src\util.js`、`docs\notes.md`，提交。
   然后**在提交之后**加两个 hook：post-checkout 用来测插件开 worktree 时有没有关掉 hook；会失败的 pre-commit 用来测讨论串会不会绕过 hook：
   ```powershell
   Set-Content -Encoding ascii D:\dsh-test\playground\.git\hooks\post-checkout "#!/bin/sh`necho ran > post-checkout-ran.txt`n"
   Set-Content -Encoding ascii D:\dsh-test\playground\.git\hooks\pre-commit "#!/bin/sh`necho ran > hook-ran.txt`nexit 1`n"
   ```
2. **长路径仓库**：根目录长度约 170 个字符，比如 `D:\dsh-test\deep\` 下面套四层各 38 个字符的目录（`aaaaaaaa…`、`bbbbbbbb…` 等）。里面提交一个相对路径约 55 个字符的文件，比如 `docs\a-rather-long-file-name-for-the-path-check-01.md`。这样它在 worktree 里的完整路径会超过 260。记下根目录的实际长度。
3. **子目录仓库** `D:\dsh-test\mono`：`packages\app\index.js`、`packages\app\README.md`、根目录 `package.json`，提交。这个仓库的项目文件夹选 `D:\dsh-test\mono\packages\app`。
4. 只读记录权限信息到 `D:\dsh-test\logs\acl.txt`：`whoami`、`(Get-Acl D:\dsh-test\playground).Owner`、`icacls D:\dsh-test\playground`。

## 第 4 步：测试

每项都按“请操作者做 → 你核对 → 记结果”走。核对时主要看三样：
- 插件的存储 `$dshHome\storages\dsh_threads.json`（JSON，`tables.threads` 里每个讨论串有 `n`、`status`、`lastReport`、`worktree.path`、`worktree.branch`、`archived` 等）；
- git 状态（`git -C <仓库> status`、`worktree list`、`branch -a`、`log --oneline --all -5`）；
- 操作者看到的界面（请他描述或截图）。

“讨论串”是插件开出来的后台会话。项目主对话里的命令以 `/thread` 开头，要在输入框里输入后回车。

1. **新建项目**：左侧“项目”分组的“+” → 名字填 `playground` → “选择文件夹…”选 `D:\dsh-test\playground` → 新建项目。期望：打开这个项目的主对话；侧栏“项目”分组出现 playground；项目设置里显示的文件夹路径正确（反斜杠、盘符）。
2. **普通讨论串**：主对话输入 `/thread 列出这个仓库的文件，每个文件一句话说明用途`。期望：马上出现“已开讨论串 #1”；过一会儿主对话里出现“讨论串回报”卡片，主对话自动接着回复一次。核对：存储里 #1 的 `status` 为 `idle`、`lastReport.status` 为 `done`。
3. **worktree 讨论串和仓库 hook**：输入 `/thread -w 在 docs 下新建 windows.md，写一行 hello windows，然后提交到你的分支`。插件自己调用 git（开、删 worktree）时会关掉仓库的 hook；讨论串自己提交时，仓库的 hook 照常执行。期望：
   - `git -C D:\dsh-test\playground worktree list` 里有 `.agents/worktrees/dsh-threads-2-…`，worktree 根目录里**没有** `post-checkout-ran.txt`（有就说明插件在 Windows 上关不掉自己那次 git 调用的 hook）；
   - 讨论串的提交被 pre-commit hook 挡住，它回报 `blocked` 并说明 hook 失败，**没有**用 `--no-verify` 绕过，也没删 `hook-ran.txt`；分支上没有新提交；
   - 项目文件夹 `git status` 干净；
   - 存储里这个讨论串的 `worktree.path`、`repositoryRoot` 原样抄进报告，并确认路径用 `Test-Path` 能访问。
4. **清理 worktree**：主对话输入 `/thread cleanup`，再输入 `/thread cleanup confirm`。期望：第一条只列出、不删除；第二条跳过第 3 项那个有未提交改动的 worktree，并说明原因。然后删掉 playground 的 pre-commit hook（`Remove-Item D:\dsh-test\playground\.git\hooks\pre-commit`），再开 `/thread -w 在 docs 下新建 clean.md，写一行 clean，然后提交到你的分支`，等它提交成功并回报后，再 `/thread cleanup confirm`。期望：这个干净的 worktree 被删掉，分支因为没合并而保留。核对 `worktree list` 和目录是否还在。
5. **文件被占用时清理**：再开一个 `/thread -w 在 docs 下新建 lock.md，写一行 lock，然后提交到你的分支`，等它回报。然后在另一个 PowerShell 窗口里 `Set-Location` 进这个 worktree 目录并保持窗口打开，同时请操作者用记事本打开里面的 `docs\lock.md`。这时输入 `/thread cleanup confirm`。记下插件的回复原文和目录是否还在。关掉记事本和那个 PowerShell 后再 `/thread cleanup confirm` 一次，记下结果。
6. **长路径**：用长路径仓库的根目录新建项目 `deep`，在它的主对话输入 `/thread -w 在 docs 下新建 check.md，写一行 ok，然后提交到你的分支`。记下成功与否；失败时记下回复和讨论串里的报错原文（多半和 260 字符限制、`core.longpaths` 有关）。
7. **子目录项目**：用 `D:\dsh-test\mono\packages\app` 新建项目 `mono`，输入 `/thread -w 在当前项目文件夹里新建 hello.txt，写一行 hi，然后提交到你的分支`。期望：文件出现在 worktree 的 `packages\app\hello.txt`，而不是 worktree 根目录。核对分支上的文件路径。
8. **审批模式沿用**：回到 playground 主对话，把输入框左下角的权限选成“仅可查看”。输入 `/thread 在 docs 下新建 approval.md，写一行 hi`。期望：讨论串要写文件时弹出审批（“允许 / 拒绝”），**不会自动通过**；右侧“讨论串”面板里它出现在“等待您处理”，写着“等你批准一项操作”；左侧 playground 这一行显示举手。请操作者点“拒绝”。最后把主对话的权限改回原来的模式。
9. **停止**：输入 `/thread 在终端里等待 90 秒（例如 Start-Sleep 90），然后回报 done`。请操作者点主对话标题栏的“讨论串”按钮打开右侧面板，点这个讨论串，再点面板头的“停止”。期望：讨论串显示“已停止”，之后**不会**自己又开始干活；主对话不会被唤醒。等 1 分钟确认。
10. **归档**：在讨论串面板头点归档图标归档 #1。期望：它从列表消失，列表底部出现“已归档 · 1”；再打开它点“取消归档”，回到列表。
11. **桌面通知**：在项目页（左侧导航“项目”）playground 卡片的“⋮”菜单 → 通知 → 选“所有新消息”。输入 `/thread 用一句话总结 README.md`，然后马上切到别的窗口（DSH 不要在前台）。期望：讨论串或主对话做完时，Windows 右下角弹出 DeepSeek Harness 的通知。没有弹出时，请操作者看一下 Windows“设置 → 系统 → 通知”里 DeepSeek Harness 是否允许通知，记下来。
12. **完整流程**：在 playground 主对话里发一条不提“讨论串”的消息：“帮我做三件事：① 把 README.md 第一行改成‘# Playground on Windows’；② 写一份 docs/usage.md，介绍 src 里两个文件怎么用；③ 看看 src/app.js 有没有可以简化的地方，列个清单给我就行。”它开始干活后，马上再发一条：“另外，把 docs/notes.md 的标题改成‘Notes’。”记下：主对话有没有为第②件开讨论串；第二条消息隔了多久得到处理；主对话有没有自己 `git commit`、合并分支或改权限（它应该先问）；讨论串回报后它说了什么。核对 `git log --oneline --all` 和 `git status`。
13. **界面语言**：在 DSH 设置里把界面语言改成 English，在主对话输入 `/thread stop 99`。期望：回复是英文（“This main conversation has no thread #99.”）。再改回中文。

## 第 5 步：报告

写 `D:\dsh-test\report.md`，包括：

1. 环境：Windows 版本、PowerShell 版本、git 路径和版本、`core.longpaths` / `core.autocrlf`、DSH 安装路径和版本、`$dsh` 路径、`$dshHome` 路径、插件安装输出、`acl.txt` 的要点。
2. 一张表：每个测试一行，列为“编号 | 结果（通过 / 失败 / 部分通过 / 未执行）| 现象 | 证据”。证据写命令输出的关键几行、截图文件名或操作者的描述。
3. 失败或可疑的地方，单独一节，写完整报错原文和复现步骤。
4. 附件：把 `$dshHome\storages\dsh_threads.json` 复制到 `D:\dsh-test\logs\`；如果能找到 DSH 的日志目录（在 `$dshHome` 或 `%APPDATA%` 下找名字含 `log` 的目录），把最近的日志也复制过去。

最后把整个 `D:\dsh-test\logs` 和 `report.md` 打包成 `D:\dsh-test\dsh-threads-windows-report.zip`，告诉操作者文件位置。不要卸载 DSH，也不要删测试目录，等操作者决定。
