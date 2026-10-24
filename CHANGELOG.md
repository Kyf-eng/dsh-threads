# Changelog

## Unreleased

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
