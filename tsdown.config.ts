import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { name } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { name: string }

// The DSH browser host serves dist/client.js as-is and expects it to register itself
// (same shape as every first-party lib/client.js): a CJS body inside a factory that
// receives the host's module table as `require`.
const clientBanner = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
].join('\n')
const clientFooter = '\t\treturn module.exports;\n\t}\n});'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outDir: 'dist',
    clean: false,
    dts: false,
    fixedExtension: false,
    // Every @deepseek-ai/* import must resolve to the running DSH's own copy.
    deps: { neverBundle: true },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    tsconfig: 'tsconfig.client.json',
    outDir: 'dist',
    clean: false,
    dts: false,
    fixedExtension: false,
    outExtensions: () => ({ js: '.js' }),
    // react, react/jsx-runtime and @deepseek-ai/* come from the host's frozen module table.
    deps: { neverBundle: true },
    banner: clientBanner,
    footer: clientFooter,
  },
])
