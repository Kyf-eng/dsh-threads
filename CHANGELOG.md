# Changelog

## Unreleased

- M1 single-thread loop:
  - `thread_open` (`user_asked`, or `offer` with a confirmation question), `thread_status`, and `thread_report` for thread sessions.
  - `/thread <task>`.
  - Reports go back to the main conversation with Claude-style wake rules and a wake-up loop guard; when a thread did not report, its last reply is used instead.
  - Threads inherit the main conversation's permission preset.
  - State persists in DSH storage (`dsh_threads`).

- M0 skeleton: bundle manifest, `thread_status` probe tool (with `spawn` probe session), empty right-sidebar "Threads" tab, `POST /api/dsh-threads` ping route, dev-install script.
