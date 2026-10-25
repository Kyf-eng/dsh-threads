import { describe, expect, it } from 'vitest'
import { changelogSection, prepareRelease } from '../scripts/release.ts'

// The checks .github/workflows/release.yml runs before it publishes a tag.

const changelog = `# Changelog

## 0.2.0 — 2026-11-01

Projects learn to wait.

- Waiting projects.
- Fix: a thing.

## 0.1.0 — 2026-10-30

- First.
`
const url = 'https://github.com/o/r/releases/download/v0.2.0/kyf-eng-dsh-threads-0.2.0.tgz'
const readme = `dsh plugin --profile desktop add ${url}\n\`github:o/r#v0.2.0\` works too.`
const input = { tag: 'v0.2.0', pkg: { name: '@kyf-eng/dsh-threads', version: '0.2.0' }, changelog, readmes: { 'README.md': readme, 'README.en.md': readme }, repository: 'o/r' }

describe('release', () => {
  it('reads one CHANGELOG section', () => {
    expect(changelogSection(changelog, '0.1.0')).toBe('- First.')
    expect(changelogSection(changelog, '0.3.0')).toBeUndefined()
  })

  it('writes the notes: intro, install command, changes', () => {
    const release = prepareRelease(input)
    expect(release).toMatchObject({ version: '0.2.0', prerelease: false, tarball: 'kyf-eng-dsh-threads-0.2.0.tgz' })
    expect(release.notes.startsWith('Projects learn to wait.\n\n## Install\n')).toBe(true)
    expect(release.notes).toContain(`dsh plugin --profile desktop add ${url}`)
    expect(release.notes.endsWith('## Changes\n\n- Waiting projects.\n- Fix: a thing.\n')).toBe(true)
    expect(prepareRelease({ ...input, tag: 'v0.2.0-rc.1', pkg: { ...input.pkg, version: '0.2.0-rc.1' }, changelog: changelog.replace('0.2.0 —', '0.2.0-rc.1 —'), readmes: {} }).prerelease).toBe(true)
  })

  it('refuses a tag the package, CHANGELOG or READMEs do not agree with', () => {
    expect(() => prepareRelease({ ...input, tag: 'v0.2.1' })).toThrow(/does not match package.json version 0.2.0[\s\S]*README.md does not install from/)
    expect(() => prepareRelease({ ...input, changelog: '# Changelog\n' })).toThrow('CHANGELOG.md has no "## 0.2.0')
    expect(() => prepareRelease({ ...input, readmes: { 'README.en.md': 'old' } })).toThrow('README.en.md does not install from')
  })
})
