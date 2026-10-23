# Changelog

## Unreleased

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
