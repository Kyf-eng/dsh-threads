import { describe, expect, it } from 'vitest'
import { pickerUnavailable } from '../../src/client/picker.ts'

describe('pickerUnavailable', () => {
  it('recognises DSH\'s typed error by its code', () => {
    expect(pickerUnavailable(Object.assign(new Error('no picker'), { code: 'directory-picker/unavailable' }))).toBe(true)
    expect(pickerUnavailable({ code: 'directory-picker/unavailable', capability: 'native' })).toBe(true)
  })

  it('recognises what DSH Web answers: a plain Error naming the missing native capability', () => {
    expect(pickerUnavailable(new Error('directoryPicker.pick needs the native capability; the composed picker serves "browse"'))).toBe(true)
    expect(pickerUnavailable('directory-picker/unavailable')).toBe(true)
  })

  it('leaves real failures alone, also ones that merely mention "unavailable" or "not supported"', () => {
    expect(pickerUnavailable(new Error('HTTP 503 Service Unavailable'))).toBe(false)
    expect(pickerUnavailable(new Error('operation not supported'))).toBe(false)
    expect(pickerUnavailable(Object.assign(new Error('cannot read /root'), { code: 'directory-picker/unreadable' }))).toBe(false)
    expect(pickerUnavailable(null)).toBe(false)
    expect(pickerUnavailable(undefined)).toBe(false)
  })
})
