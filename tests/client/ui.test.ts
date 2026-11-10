import { describe, expect, it } from 'vitest'
import { fileKind } from '../../src/client/ui.tsx'

describe('fileKind', () => {
  it('goes by the extension, whatever the folder and the case', () => {
    expect(fileKind('docs/notes.md')).toBe('doc')
    expect(fileKind('src\\client\\App.TSX')).toBe('code')
    expect(fileKind('package.json')).toBe('data')
    expect(fileKind('archive.tar.gz')).toBe('other')
  })

  it('looks a leading-dot name up like any other', () => {
    expect(fileKind('.env')).toBe('data')
    expect(fileKind('config/.env')).toBe('data')
    expect(fileKind('.gitignore')).toBe('other')
  })

  it('has no kind for a name without an extension', () => {
    expect(fileKind('Makefile')).toBe('other')
    expect(fileKind('notes.')).toBe('other')
    expect(fileKind('')).toBe('other')
  })
})
