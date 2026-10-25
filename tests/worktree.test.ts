import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { msg } from '../src/messages.ts'
import { createWorktree, type Git, removeWorktree, systemGit, WorktreeError, worktreeFolder } from '../src/worktree.ts'

// Real git in throwaway repositories: these are git's rules we rely on, not ours.
const git: Git = (cwd, args) => systemGit(cwd, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args])
const dirs: string[] = []

async function repo(withCommit = true): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-threads-wt-'))
  dirs.push(dir)
  await git(dir, ['init', '-q', '-b', 'main'])
  if (withCommit) {
    await writeFile(join(dir, 'a.txt'), 'a\n')
    await git(dir, ['add', '.'])
    await git(dir, ['commit', '-qm', 'init'])
  }
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('createWorktree', () => {
  it('checks out a new branch from HEAD in a self-ignoring pool, leaving uncommitted files behind', async () => {
    const root = await repo()
    await writeFile(join(root, 'draft.txt'), 'not committed\n')
    const head = (await git(root, ['rev-parse', 'HEAD'])).trim()

    const worktree = await createWorktree(git, root, '3-abc123')

    expect(worktree.branch).toBe('dsh-threads/3-abc123')
    expect(worktree.baseCommit).toBe(head)
    expect(worktree.path.endsWith(join('.agents', 'worktrees', 'dsh-threads-3-abc123'))).toBe(true)
    expect((await git(worktree.path, ['branch', '--show-current'])).trim()).toBe('dsh-threads/3-abc123')
    expect(existsSync(join(worktree.path, 'a.txt'))).toBe(true)
    expect(existsSync(join(worktree.path, 'draft.txt'))).toBe(false)
    expect(await readFile(join(worktree.repositoryRoot, '.agents', 'worktrees', '.gitignore'), 'utf8')).toBe('*\n')
    // The pool does not show up as a change in the project folder.
    expect((await git(root, ['status', '--porcelain'])).trim()).toBe('?? draft.txt')
  })

  it('maps a project in a subfolder of the repository to the same subfolder of the checkout', async () => {
    const root = await repo()
    await mkdir(join(root, 'packages', 'app'), { recursive: true })
    await writeFile(join(root, 'packages', 'app', 'b.txt'), 'b\n')
    await git(root, ['add', '.'])
    await git(root, ['commit', '-qm', 'package'])

    const worktree = await createWorktree(git, join(root, 'packages', 'app'), '2-sub')

    expect(worktree.subdir).toBe('packages/app')
    expect(worktree.path.endsWith(join('.agents', 'worktrees', 'dsh-threads-2-sub'))).toBe(true)
    expect(existsSync(join(worktreeFolder(worktree), 'b.txt'))).toBe(true)
    expect((await createWorktree(git, root, '2-root')).subdir).toBe('')
  })

  it('refuses a subfolder that is not committed yet, creating nothing', async () => {
    const root = await repo()
    await mkdir(join(root, 'fresh'))
    await expect(createWorktree(git, join(root, 'fresh'), '1-y')).rejects.toBeInstanceOf(WorktreeError)
    expect((await git(root, ['branch', '--list', 'dsh-threads/*'])).trim()).toBe('')
  })

  it('refuses a folder that is not a repository, or one without commits', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'dsh-threads-plain-'))
    dirs.push(plain)
    await expect(createWorktree(git, plain, '1-x')).rejects.toBeInstanceOf(WorktreeError)
    await expect(createWorktree(git, await repo(false), '1-x')).rejects.toBeInstanceOf(WorktreeError)
    await expect(createWorktree(git, plain, '1-x')).rejects.toThrow(msg().notARepository(plain))
  })

  it('says when git itself is missing or refuses, instead of calling the folder no repository', async () => {
    const failing = (error: object): Git => () => Promise.reject(Object.assign(new Error('git failed'), error))
    await expect(createWorktree(failing({ code: 'ENOENT' }), 'D:\\repo', '1-x')).rejects.toThrow(msg().gitMissing)
    const dubious = failing({ code: 128, stderr: "fatal: detected dubious ownership in repository at 'D:/repo'\r\nTo add an exception…\r\n" })
    await expect(createWorktree(dubious, 'D:\\repo', '1-x')).rejects.toThrow(msg().gitFailed('D:\\repo', "detected dubious ownership in repository at 'D:/repo'"))
  })
})

describe('removeWorktree', () => {
  it('removes a clean checkout and deletes its branch when nothing on it is unmerged', async () => {
    const worktree = await createWorktree(git, await repo(), '1-a')
    expect(await removeWorktree(git, worktree)).toEqual({ outcome: 'removed', branchKept: false })
    expect(existsSync(worktree.path)).toBe(false)
  })

  it('keeps a branch with unmerged commits, and never removes a checkout with changes', async () => {
    const committed = await createWorktree(git, await repo(), '1-b')
    await writeFile(join(committed.path, 'b.txt'), 'b\n')
    await git(committed.path, ['add', '.'])
    await git(committed.path, ['commit', '-qm', 'thread work'])
    expect(await removeWorktree(git, committed)).toEqual({ outcome: 'removed', branchKept: true })

    const dirty = await createWorktree(git, await repo(), '1-c')
    await writeFile(join(dirty.path, 'c.txt'), 'c\n')
    expect(await removeWorktree(git, dirty)).toEqual({ outcome: 'dirty', branchKept: true })
    expect(existsSync(join(dirty.path, 'c.txt'))).toBe(true)
  })
})
