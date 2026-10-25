// Release checks and notes, run by .github/workflows/release.yml when a `v*` tag is pushed:
//   node scripts/release.ts <tag> <notes-file>
// It fails unless the tag, package.json's version and a CHANGELOG heading name the same version,
// then writes the GitHub Release notes: the CHANGELOG section's opening paragraph, the install
// commands, and its list of changes. The READMEs install by package name from npm, so a release
// does not touch them.
//   node scripts/release.ts --npm-tag <version> <published-versions-json>
// prints the npm dist-tag for the version (see npmTag).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ReleaseInput {
  tag: string
  pkg: { name: string; version: string }
  changelog: string
  repository: string
}

export interface Release {
  version: string
  prerelease: boolean
  /** File name `npm pack` gives the package (`@kyf-eng/dsh-threads` → `kyf-eng-dsh-threads-<version>.tgz`). */
  tarball: string
  notes: string
}

/** The CHANGELOG section for `version` (`## <version> — <date>`), without its heading. */
export function changelogSection(changelog: string, version: string): string | undefined {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `))
  if (start === -1) return undefined
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim()
}

export function prepareRelease(input: ReleaseInput): Release {
  const { tag, pkg, changelog, repository } = input
  const problems: string[] = []
  const version = pkg.version
  if (tag !== `v${version}`) problems.push(`tag ${tag} does not match package.json version ${version}`)
  const tarball = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`
  const download = `https://github.com/${repository}/releases/download/${tag}/${tarball}`
  const section = changelogSection(changelog, version)
  if (section === undefined) problems.push(`CHANGELOG.md has no "## ${version} — <date>" section`)
  if (problems.length > 0) throw new Error(`release ${tag} is not ready:\n- ${problems.join('\n- ')}`)

  // The opening paragraph (if any) introduces the release; the rest is the list of changes.
  const blocks = (section as string).split(/\n\s*\n/)
  const intro = blocks[0] !== undefined && !blocks[0].startsWith('- ') ? blocks.shift() : undefined
  const notes = [
    ...(intro === undefined ? [] : [intro, '']),
    '## Install',
    '',
    'Quit DeepSeek Harness completely, then:',
    '',
    '```sh',
    `dsh plugin --profile desktop add ${pkg.name}@${version}`,
    '```',
    '',
    `or from this release: \`dsh plugin --profile desktop add ${download}\``,
    '',
    `Use \`--profile web\` for the Web app. If an earlier version of \`${pkg.name}\` is installed, this command replaces it. Usage, configuration and known limitations: [README（中文）](https://github.com/${repository}#readme) · [English](https://github.com/${repository}/blob/main/README.en.md).`,
    '',
    '## Changes',
    '',
    blocks.join('\n\n'),
  ].join('\n')
  return { version, prerelease: version.includes('-'), tarball, notes: `${notes}\n` }
}

/**
 * npm dist-tag for a version: `latest` for a release, and for a pre-release while no release
 * exists yet (then it is the newest thing to install); `next` for a pre-release once one does, so
 * `dsh plugin add <name>` keeps installing the release.
 */
export function npmTag(version: string, published: readonly string[]): 'latest' | 'next' {
  if (!version.includes('-')) return 'latest'
  return published.some((candidate) => !candidate.includes('-')) ? 'next' : 'latest'
}

/** `npm view <name> versions --json`: an array, a single string, or nothing before the first publish. */
export function parsePublished(json: string): string[] {
  if (json.trim() === '') return []
  const value: unknown = JSON.parse(json)
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : typeof value === 'string' ? [value] : []
}

function main(argv: string[]): void {
  if (argv[0] === '--npm-tag') {
    const [, version, published] = argv
    if (version === undefined) throw new Error('usage: node scripts/release.ts --npm-tag <version> <published-versions-json>')
    console.log(npmTag(version, parsePublished(published ?? '')))
    return
  }
  const [tag, notesFile] = argv
  if (tag === undefined || notesFile === undefined) throw new Error('usage: node scripts/release.ts <tag> <notes-file>')
  const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const pkg = JSON.parse(read('package.json')) as { name: string; version: string; repository: { url: string } }
  const repository = pkg.repository.url.replace(/^git\+https:\/\/github\.com\//, '').replace(/\.git$/, '')
  const release = prepareRelease({
    tag, pkg, repository,
    changelog: read('CHANGELOG.md'),
  })
  writeFileSync(notesFile, release.notes)
  // For the workflow's next steps.
  console.log(JSON.stringify({ version: release.version, prerelease: release.prerelease, tarball: release.tarball }))
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
