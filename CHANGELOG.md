# Changelog

## 0.1.0 — 2026-10-26

First stable release, for DeepSeek Harness 0.2.x (tested on 0.2.1-rc.2 and 0.2.1-rc.3). The code is the same as 0.1.0-rc.9. From 0.1.0-rc.7 or later, the same `dsh plugin add` command upgrades it; from 0.1.0-rc.6 or earlier, remove `@fky/dsh-threads` first (see 0.1.0-rc.7). Projects and threads are kept.

What 0.1.0 does, gathered from the release candidates below:

- Projects: a folder plus a standing main conversation, created from the sidebar's "Projects" section (with the system folder chooser) or with "Make project" on a conversation. A project has an icon, a goal for the coordinator, and instructions every thread also receives; its menu pins, archives, deletes, sets desktop notifications and opens settings (coordinator and thread models, token usage).
- Threads: the main conversation opens threads for self-contained work, sends them follow-ups, and suggests ones you did not ask for (in a card above the composer; they start only when you click). Each thread is a real session that opens in the right pane, where you can talk to it, stop it, mark it resolved or archive it. `/thread <task>` opens one directly.
- Reports: a thread reports what it did, which files changed and what it needs you to decide. The main conversation wakes once, after all its running threads have finished, with a guard against wake-up loops; a thread that forgets to report is reminded once.
- Parallel and isolated: up to 3 threads per main conversation run at once (`maxRunning`). A thread that changes files can work in its own git worktree and branch (`dsh-threads/<n>-<id>`); the main conversation merges only when you ask, and `/thread cleanup` removes finished worktrees.
- A coordinator that leads: it hands documents, multi-file changes and investigations to threads, does not commit, merge or switch branches unless asked, and does not get around git hooks or permission checks.
- Claude-style interface: thread cards and "↳ N replies" in the conversation, a raised hand when a thread waits for you, a breathing dot while threads run, file and branch chips, and a "Projects" section in the sidebar. Project conversations and threads stay out of DSH's workspace list.
- Threads keep the main conversation's permission mode; a thread is not opened when that mode cannot be read.
- Host-side text in Chinese and English, following DeepSeek Harness's language.
- Platforms: developed and fully tested on macOS Desktop, tested twice on Windows Desktop (x64), used on Web.

## 0.1.0-rc.9 — 2026-10-26

A fix for dsh-threads going down after DeepSeek Harness reloaded it without restarting. Coming from 0.1.0-rc.6 or earlier, remove `@fky/dsh-threads` first (see 0.1.0-rc.7).

- Fix: when DeepSeek Harness reloaded the plugin while running — after a plugin manager operation found dsh-threads' files changed on disk (such as an in-app update), after a change to dsh-threads' settings, or when a service it uses restarted — dsh-threads failed to start again ("domain 'dsh_threads' is already open"). Until DeepSeek Harness restarted, the projects page and the new project dialog showed "HTTP 404", and main conversations had no thread tools or `/thread`. The plugin now releases its storage when it unloads, and takes over storage an earlier version left open, so a reload from 0.1.0-rc.8 into this version recovers without a restart.

## 0.1.0-rc.8 — 2026-10-25

Fixes from the second test on Windows. Coming from 0.1.0-rc.6 or earlier, remove `@fky/dsh-threads` first (see 0.1.0-rc.7).

- A `/thread <task>` row now shows the thread it opened right under it: live state, branch, changed files and an open button. Fix: in a new project, a first `/thread` left DeepSeek Harness on its welcome page, so it looked as if nothing had happened although the thread was running.
- Fix: when a worktree could not be checked out (on Windows, paths over 260 characters), the branch git had already created stayed behind and the pane showed git's raw command line. A failed checkout now takes back what it created; "Filename too long" explains the limit and the options (long paths for that repository only, a shorter path, or no worktree); other failures quote git's own error.
- The coordinator, like threads, skips a git hook or another check only when you ask for exactly that in your own words, and only for that one case. Before, it refused even then.

## 0.1.0-rc.7 — 2026-10-24

Fixes from the first test on Windows, and a new package name: **`@kyf-eng/dsh-threads`** (it was `@fky/dsh-threads`). The new name does not replace the old one: quit DeepSeek Harness completely, run `dsh plugin --profile desktop remove @fky/dsh-threads`, then install this version. Projects and threads are kept.

- The package is now `@kyf-eng/dsh-threads`, under the maintainer's own npm name (the same as on GitHub); `fky` on npm belongs to someone else. Projects and threads live in DeepSeek Harness's own storage, so removing the old package does not lose them.
- Fix: where DeepSeek Harness cannot find git (Windows without Git for Windows), a worktree thread was refused with "the project folder is not a git repository". It now says git was not found and how to fix it; other git errors (such as Windows' "dubious ownership") are quoted as git wrote them.
- Threads and the coordinator no longer get around checks: no skipping git hooks with `--no-verify`, no editing hooks or deleting what they wrote, no changing file permissions, execution policies, the sandbox or global git settings to make a command work. A thread stopped by a hook or a permission reports "blocked" with the error; the coordinator tells you what failed instead of repairing the system itself. On Windows, a thread had committed past a failing hook and the coordinator had loosened PowerShell's execution policy.
- The README is in Chinese by default; the English one is `README.en.md`.

## 0.1.0-rc.6 — 2026-10-24

Release candidate after the release review: fixes found in it, stopping and archiving threads, both languages on the host side, a threads panel after Claude's, a coordinator that leads instead of doing the work itself, and testing on DeepSeek Harness 0.2.1-rc.3.

- The threads panel follows Claude's: a "Threads" title with search, then sections with counts — waiting for you, running, idle, resolved, archived — each foldable, with dashed placeholders when empty, and compact rows (state, title, time, what it waits on, changed files, branch).
- A thread (or the main conversation) holding an approval, a question or a plan to review now shows the raised hand everywhere — the panel ("waiting for your approval"), the cards, the header, and the project's sidebar row — and raises a notification while DeepSeek Harness is in the background. Before, threads hidden from DSH's session list showed only "running" while they waited.
- Tested on DeepSeek Harness 0.2.1-rc.3, including that threads keep the main conversation's approval mode on a stock install: the known limitation is gone.
- The coordinator acts as the project's lead: documents, multi-file changes, investigations and long or visual checks go to threads (not subagents); it does not commit, merge or switch branches unless asked; a short reminder of these rules follows every new message, so long conversations keep them.
- Fix: after a project is deleted, its threads are ordinary conversations again, as the delete dialog says: they show in DSH's session list, lose the thread tools, and no longer report to the old main conversation. Deleting a project, like archiving it, waits until no thread is running.
- Fix: a thread could start under DSH's default permission mode when its main conversation was not loaded (for example a queued suggestion starting after a restart). The main conversation is now loaded first, and when its mode cannot be read — or it uses custom settings that match no mode — the thread is not opened.
- Stop and archive single threads. The thread pane's header has **Stop** while the thread runs (also `/thread stop <n>`) and **Archive** when it does not; archived threads leave the list (they wait under "Archived · N" and can be unarchived) and the counts, and the main conversation cannot send them follow-ups. A stopped round, whether stopped there or with DeepSeek Harness's own stop button, is no longer reminded back to work: it reaches the main conversation quietly as "stopped", and the coordinator does not restart it on its own.
- Fix: the threads list scrolls; with many threads the last ones were cut off.
- The host half speaks the page's language: the "open a thread?" question, `/thread` replies, errors in the panes, the task cards in a thread, tool results and reports are in English or Chinese, following DeepSeek Harness's language (English until the page has loaded). The "write the full path" hint uses this system's own path form.
- Fix: when a project's folder is a subfolder of a git repository (a monorepo package), a worktree thread now works in that subfolder of its checkout instead of the repository root. A subfolder that is not committed yet is refused before anything is created.

## 0.1.0-rc.5 — 2026-10-24

Fixes from a full run of the test prompts: the main conversation knows when a change was the user's own request, and choices go to threads.

- A report from a round the user drove in the thread says so and quotes the user's words, so the main conversation treats the change as the user's decision instead of something the thread did on its own. Words the user adds during a dispatched round are quoted too.
- The coordinator hands choices to the thread: when a task starts with options for the user to pick, the thread presents them and waits (raised hand) instead of the main conversation drafting and asking first. When a thread waits on the user, the main conversation says so in a line instead of asking again with a question box.
- The coordinator keeps its own turns short (merge what was asked, run the project's tests, report) and gives longer checks and new writing to threads, so the user can always reach it.

## 0.1.0-rc.4 — 2026-10-24

Projects get their own section in the sidebar, after Claude's, and the running mark breathes in place.

- The running mark breathes in place, dim to bright, instead of a spreading blue ring.
- The sidebar has its own "Projects" section, after Claude's: one row per project (a raised hand, a breathing dot or the project icon; ↳N; the "⋮" menu on hover), pinned first, then by latest activity. A row opens the project's main conversation. "+" creates a project.
- Project main conversations no longer appear in DSH's workspace list, and a workspace drops out when nothing but project sessions would show in it.
- Fix: a thread that finished while another was still running kept showing "running" in the reply card and the header (they reloaded just before the host recorded the finish); thread views now reload once more shortly after a session stops.

## 0.1.0-rc.3 — 2026-10-24

The projects page, the card menu and project settings, reworked after Claude's.

- Projects page and dialogs after Claude's:
  - "New project" picks the folder with the system folder chooser (a typed path only where no chooser exists), fills the name from the folder, and offers recent folders.
  - Project cards: icon, blue pin, a "⋮" menu with Pin (P), Notifications (four levels), Settings (S), Archive (A) and Delete (D).
  - Archive / unarchive a project together with its main conversation and threads.
  - Project settings: name and icon (24 icons), goal (main conversation only), folder, and project instructions ("Memory").
  - The main conversation's sidebar row shows the project icon.
  - Project settings → Models: coordinator model and thinking (applied to the main conversation at once) and thread model and thinking (applied to new threads), from DSH's own model catalog; DSH's default for new sessions is left unchanged.
  - Project settings → Usage: input and output tokens of the main conversation and every thread.
  - Notifications: while DeepSeek Harness is in the background, a project raises desktop notifications at its level (all new messages; the main conversation and threads waiting for you; only threads waiting for you; none). Clicking one opens the conversation or thread.

## 0.1.0-rc.2 — 2026-10-24

Fixes found after rc.1, in an end-to-end run and a pass over every surface in dark and light mode.

- Fix: colors derived from DSH's theme (borders, hover and button fills, focus ring) were computed on `:root`, where DSH's theme variables are not defined, so they were empty; in light mode project cards had no border at all.
- "↳ N replies" cards size to their content; thread pane buttons have icons; project cards have a resting shadow.
- Fix: a user message in the main conversation now always resets the wake-up streak, even while a report is being delivered (found in an end-to-end run).
- `maxAutoWakes: 0` is documented as "never wake automatically".

## 0.1.0-rc.1 — 2026-10-24

First pre-release, for DeepSeek Harness 0.2.1-rc.2.

- Report reminder: when a task round ends without `thread_report`, the thread is asked once to report (`reportReminder`, on by default); if it still does not, its reply from before the reminder is used.

- M3c Claude-style UI:
  - Threads no longer appear in the left session list; a project's main conversation row shows ↳N, plus a raised hand when a thread waits for you and a breathing dot while threads run.
  - One design kit for every surface: state marks (breathing dot, raised hand, hollow ring, check), thread items with an amber "waiting for you" box, green/blue/amber file chips, purple branch chips, pill buttons.
  - Report cards show each thread's live state and list waiting threads first; "↳ N replies" is compact; the proposals card starts one or all suggestions.
  - Thread pane header with branch chip; Claude's "This thread is resolved" composer bar.
  - New project from any folder path (added as a workspace when needed).

- M3b worktrees:
  - `thread_open` / `thread_propose` take `worktree: true` (and `/thread -w <task>`): the thread gets its own git worktree under `.agents/worktrees` and its own branch `dsh-threads/<n>-<id>`, commits there and never touches the project folder.
  - Reports name the branch; the main conversation merges only when the user asks.
  - `/thread cleanup` lists finished worktrees, `/thread cleanup confirm` removes them; checkouts with changes are skipped and unmerged branches are kept.

- M3a parallel threads:
  - Up to 3 threads per main conversation run at once (`maxRunning` default 3).
  - Opening threads is serialized per main conversation, so parallel `thread_open` calls and queued proposals cannot overshoot the limit or share a number.
  - Reports still wait until no thread is running and arrive as one message, including when two threads finish at the same moment.
  - Prompts: the dispatcher runs only independent work in parallel; threads leave other threads' changes alone and do not commit, switch branches or reset unless asked.

- M2c thread cards:
  - Reports, briefs and follow-ups show as thread cards in the conversation instead of a plain notice row; a batch of reports arrives as one card.
  - "N replies" at the end of a turn that opened threads, with live status.
  - `thread_propose`: the model's own suggestions wait in a checklist card above the composer ("Start N threads" / "Dismiss all"). At most 3 per turn, expiring after 7 days; ones over the running limit queue and start when a slot frees up.
  - Thread and project icons on session rows in the left sidebar.

- M2b thread pane:
  - Threads open in the right sidebar with their live conversation and their own composer.
  - A "Threads" list tab.
  - "Threads · N" in a project main conversation's header, "Back to main conversation" in a thread's.
  - "Mark resolved / Reopen": a resolved thread's composer is locked until it is reopened.

- M2a projects:
  - A project is one folder plus one standing main conversation. Only a project's main conversation can open threads, and its instructions reach the main conversation and every thread.
  - A "Projects" entry in the left sidebar opens a projects page (create, search, sort, pin, remove).
  - "Make project" in a conversation's menu.
  - `thread_reply` sends more instructions to an existing thread.
  - Threads that were running when DSH stopped are settled on the next start.

- M1 single-thread loop:
  - `thread_open` (`user_asked`, or `offer` with a confirmation question), `thread_status`, and `thread_report` for thread sessions.
  - `/thread <task>`.
  - Reports go back to the main conversation with Claude-style wake rules and a wake-up loop guard; when a thread did not report, its last reply is used instead.
  - Threads inherit the main conversation's permission preset.
  - State persists in DSH storage (`dsh_threads`).

- M0 skeleton: bundle manifest, `thread_status` probe tool (with `spawn` probe session), empty right-sidebar "Threads" tab, `POST /api/dsh-threads` ping route, dev-install script.
