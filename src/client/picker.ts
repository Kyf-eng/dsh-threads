// Telling "there is no folder chooser here" apart from "the chooser failed".

/**
 * Whether a failed `uiWorkspace.pickDirectory()` means this deployment has no native folder
 * chooser (Web, where folders are browsed in-page), so the dialog should offer the path field
 * instead of an error.
 *
 * DSH's typed error is `directory-picker/unavailable`. DSH Web 0.2.1-rc.5 answers with a plain
 * Error instead: `directoryPicker.pick needs the native capability; the composed picker serves
 * "browse"`. Only these two shapes count: any other failure (a 503 "Service Unavailable", say)
 * is a real error and must reach the user.
 */
export function pickerUnavailable(failure: unknown): boolean {
  const code = String((failure as { code?: unknown } | null | undefined)?.code ?? '')
  if (code.includes('unavailable')) return true
  const message = failure instanceof Error ? failure.message : String(failure)
  return /directory-picker\/unavailable|needs the native capability/i.test(message)
}
