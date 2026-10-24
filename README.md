# dsh-threads

English | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin, modelled on Claude's projects and threads. Your project's main conversation acts as a dispatcher: when a task is self-contained, it opens a **thread** (a real session you can click into and keep talking to), and when the thread finishes, a short report comes back to the main conversation.

> Status: **0.1.0-rc.3**, a pre-release. Built and tested against DeepSeek Harness 0.2.1-rc.2. See [CHANGELOG.md](CHANGELOG.md) and the design notes in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

## What it does

- **Projects**: one folder plus one standing main conversation, with an icon, a goal for the coordinator, and instructions every thread also gets. Create one from **Projects** in the sidebar (the system folder chooser picks the folder), or turn a conversation into a project from its "…" menu. A card's "⋮" menu pins, archives, deletes, sets the project's desktop notifications, and opens its settings (models for the coordinator and threads, usage).
- **Threads**: the main conversation opens threads for self-contained work, sends follow-ups to them, and suggests threads you did not ask for (they wait in a card above the composer until you start them). Each thread is a real session: open it in the right sidebar and talk to it directly.
- **Reports**: threads report what is done, what changed and what you need to decide. The main conversation is woken once, when none of its threads is still running, with a guard against wake-up loops. A thread that forgets to report is reminded once.
- **Parallel and isolated**: up to 3 threads run at once. Threads that change files work in their own git worktree and branch (`dsh-threads/<n>-<id>`), so the project folder is never touched; the main conversation merges only when you ask, and `/thread cleanup` removes finished worktrees.
- **Claude-style UI**: thread cards in the conversation, "↳ N replies", a raised hand for threads waiting on you, a breathing dot for running ones, file and branch chips. The sidebar has its own **Projects** section: one row per project (its state and ↳N), which opens the main conversation. Project conversations and threads stay out of the workspace list.

## Install

Requires DeepSeek Harness **0.2.1-rc.2** (Desktop or Web) and its `dsh` command line. On Desktop it is set up from the app menu (**Manage dsh command…**).

1. Quit DeepSeek Harness completely.
2. Add the plugin to your profile:

   ```sh
   dsh plugin --profile desktop add https://github.com/Kyf-eng/dsh-threads/releases/download/v0.1.0-rc.3/fky-dsh-threads-0.1.0-rc.3.tgz
   ```

   Use `--profile web` for the Web app. `github:Kyf-eng/dsh-threads#v0.1.0-rc.3` works too.
3. Start DeepSeek Harness. **Projects** appears in the sidebar.

To remove it: `dsh plugin --profile desktop remove @fky/dsh-threads`.

## Use

1. **Projects → New project**: name it and pick a folder (any folder; it becomes a workspace if it is not one).
2. In the project's main conversation, ask for work in the background ("open a thread to…"). You can also type `/thread <task>`, or `/thread -w <task>` for a thread with its own worktree.
3. Click a thread card to open the thread on the right. Talk to it there; **Mark resolved** when you are done with it.
4. When the model suggests threads, start one, all, or none from the card above the composer.
5. A worktree thread's changes stay on its branch. Merge it yourself or ask the main conversation to, then run `/thread cleanup` (and `/thread cleanup confirm`).

## Configuration

Add a `config` to the plugin's entry in your profile's `cordis.patch.yml` (for Desktop, `~/.dsh/profiles/desktop/cordis.patch.yml`):

```yaml
- id: dsh-threads
  config:
    maxRunning: 2
```

| Option | Default | Meaning |
| --- | --- | --- |
| `maxRunning` | 3 | Threads one main conversation may run at once |
| `maxAutoWakes` | 5 | Automatic wake-ups in a row before reports wait for you (0: never wake automatically) |
| `noteMaxChars` | 400 | Longest report delivered to the main conversation |
| `summaryMaxChars` | 300 | Longest summary a thread may submit |
| `proposalTtlDays` | 7 | Days before an unstarted suggestion expires |
| `maxProposalsPerTurn` | 3 | Suggestions the model may make at once |
| `reportReminder` | true | Remind a thread once when it ends a task without reporting |
| `inheritPermissionPreset` | true | Threads get the main conversation's permission preset |

## Known limitations

- DeepSeek Harness lists 5 sessions per workspace and counts hidden threads among them, so a workspace with many threads shows fewer rows, and its "show N more" count includes threads.
- A worktree starts from the folder's last commit: uncommitted changes are not in it, and dependencies (`node_modules`, …) have to be installed there.
- That threads keep the main conversation's approval mode has only been checked on a modified local install so far, not on a stock one.

## Development

Requires Node ≥ 22.19.

```sh
npm install
npm run check
# quit DeepSeek Harness completely, then:
npm run dev:install
```

## License

MIT
