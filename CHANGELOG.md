# Changelog

## Unreleased

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
