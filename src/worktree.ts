// Git worktrees for threads that change files (M3b; Claude's `use_worktree`). DSH's own
// worktree service is not mounted on Desktop by default and cannot remove checkouts, so the
// plugin runs git itself: the pool DSH uses (`<repo>/.agents/worktrees`, ignoring itself), a
// fresh branch per thread, and removal only on the user's word (`/thread cleanup confirm`).
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
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
  } catch {
    throw new WorktreeError(`项目文件夹 ${folder} 不是 git 仓库，没法开 worktree。不用 worktree 再开，或者请用户先初始化仓库。`)
  }
  let baseCommit: string
  try {
    baseCommit = (await git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim()
  } catch {
    throw new WorktreeError('仓库还没有任何提交，没法从 HEAD 开 worktree。')
  }
  if (subdir.length > 0) {
    try {
      await git(repositoryRoot, ['cat-file', '-e', `${baseCommit}:${subdir}`])
    } catch {
      throw new WorktreeError(`项目文件夹 ${subdir} 还没有提交进仓库，worktree 里不会有它。不用 worktree 再开，或者请用户先提交。`)
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
