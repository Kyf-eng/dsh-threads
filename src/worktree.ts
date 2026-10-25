// Git worktrees for threads that change files (M3b; Claude's `use_worktree`). DSH's own
// worktree service is not mounted on Desktop by default and cannot remove checkouts, so the
// plugin runs git itself: the pool DSH uses (`<repo>/.agents/worktrees`, ignoring itself), a
// fresh branch per thread, and removal only on the user's word (`/thread cleanup confirm`).
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { msg } from './messages.ts'
import type { ThreadWorktree } from './types.ts'

/** Runs git with literal arguments in `cwd`; resolves stdout, rejects with git's message. */
export type Git = (cwd: string, args: readonly string[]) => Promise<string>

const execFileAsync = promisify(execFile)

/** The system git, with repository hooks off (as DSH's worktree service does) and no prompts. */
export const systemGit: Git = async (cwd, args) => {
  const { stdout } = await execFileAsync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 1 << 20,
  })
  return stdout
}

export const BRANCH_PREFIX = 'dsh-threads/'
const POOL = ['.agents', 'worktrees'] as const

/** A refusal the model should read (not a bug). */
export class WorktreeError extends Error {}

/**
 * Why git could not find the repository: git is not on DSH's PATH (a Windows machine without Git
 * for Windows), the folder is not a repository, or git refused for its own reason (on Windows often
 * "dubious ownership"), which the user needs to read as git wrote it.
 */
function notARepository(error: unknown, folder: string): WorktreeError {
  const { code, stderr } = error as { code?: unknown; stderr?: unknown }
  if (code === 'ENOENT') return new WorktreeError(msg().gitMissing)
  const detail = typeof stderr === 'string' ? stderr.trim().split(/\r?\n/)[0] ?? '' : ''
  if (detail === '' || /not a git repository/i.test(detail)) return new WorktreeError(msg().notARepository(folder))
  return new WorktreeError(msg().gitFailed(folder, detail.replace(/^fatal:\s*/, '')))
}

/**
 * New branch `dsh-threads/<name>` checked out at `<repo>/.agents/worktrees/dsh-threads-<name>`,
 * from the folder's current HEAD. Uncommitted files in the folder are not carried over. When the
 * folder is a subfolder of the repository (a monorepo package), `subdir` names it, and the thread
 * works in the same subfolder of its checkout (`worktreeFolder`).
 */
export async function createWorktree(git: Git, folder: string, name: string): Promise<ThreadWorktree> {
  let repositoryRoot: string
  let subdir: string
  try {
    repositoryRoot = (await git(folder, ['rev-parse', '--show-toplevel'])).trim()
    // Relative to the top level as git sees it, so symlinked paths (/tmp on macOS) do not matter.
    subdir = (await git(folder, ['rev-parse', '--show-prefix'])).trim().replace(/\/+$/, '')
  } catch (error) {
    throw notARepository(error, folder)
  }
  let baseCommit: string
  try {
    baseCommit = (await git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim()
  } catch {
    throw new WorktreeError(msg().noCommits)
  }
  if (subdir.length > 0) {
    try {
      await git(repositoryRoot, ['cat-file', '-e', `${baseCommit}:${subdir}`])
    } catch {
      throw new WorktreeError(msg().subfolderNotCommitted(subdir))
    }
  }
  await preparePool(join(repositoryRoot, ...POOL))
  const branch = `${BRANCH_PREFIX}${name}`
  const path = join(repositoryRoot, ...POOL, `dsh-threads-${name}`)
  await git(repositoryRoot, ['worktree', 'add', '-b', branch, '--', path, baseCommit])
  return { path, subdir, branch, baseCommit, repositoryRoot, removed: false }
}

/** Where a worktree thread works: the project folder's counterpart inside its checkout. */
export function worktreeFolder(worktree: Pick<ThreadWorktree, 'path' | 'subdir'>): string {
  return worktree.subdir.length === 0 ? worktree.path : join(worktree.path, ...worktree.subdir.split('/'))
}

/** Create the pool with a `.gitignore` of `*` (as DSH does), keeping an existing one as it is. */
async function preparePool(pool: string): Promise<void> {
  await mkdir(join(pool, '..'), { recursive: true })
  try {
    await mkdir(pool)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return
    throw error
  }
  await writeFile(join(pool, '.gitignore'), '*\n', { flag: 'wx' })
}

export interface RemoveResult {
  /** `dirty`: git refused because the checkout has changes or untracked files; nothing was removed. */
  outcome: 'removed' | 'missing' | 'dirty'
  /** The branch stays when it has commits not merged into the repository's HEAD. */
  branchKept: boolean
}

/** Remove a thread's checkout, then its branch if it is fully merged. Never forces either. */
export async function removeWorktree(git: Git, worktree: ThreadWorktree): Promise<RemoveResult> {
  const { repositoryRoot, path, branch } = worktree
  let outcome: RemoveResult['outcome'] = 'removed'
  if (existsSync(path)) {
    try {
      await git(repositoryRoot, ['worktree', 'remove', '--', path])
    } catch {
      return { outcome: 'dirty', branchKept: true }
    }
  } else {
    outcome = 'missing'
    await git(repositoryRoot, ['worktree', 'prune'])
  }
  try {
    await git(repositoryRoot, ['branch', '-d', branch])
    return { outcome, branchKept: false }
  } catch {
    return { outcome, branchKept: true }
  }
}
