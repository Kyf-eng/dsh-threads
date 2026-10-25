// CI: the published .tgz holds exactly what DSH needs (package.json `files`), nothing more.
import { execFileSync } from 'node:child_process'

const REQUIRED = ['package.json', 'cordis.patch.yml', 'dist/index.js', 'dist/client.js', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'LICENSE']
const ALLOWED = [...REQUIRED, 'README.md', 'README.en.md', 'CHANGELOG.md']

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const [pack] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' }))
const files = pack.files.map((file) => file.path.replace(/\\/g, '/'))
const missing = REQUIRED.filter((path) => !files.includes(path))
const unexpected = files.filter((path) => !ALLOWED.includes(path))

console.log(`${pack.filename}: ${files.length} files, ${pack.size} bytes`)
if (missing.length > 0 || unexpected.length > 0) {
  if (missing.length > 0) console.error(`missing: ${missing.join(', ')}`)
  if (unexpected.length > 0) console.error(`not in package.json "files": ${unexpected.join(', ')}`)
  process.exit(1)
}
