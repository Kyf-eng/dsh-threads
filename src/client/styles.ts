// Plugin CSS, injected once like first-party client plugins do (a <style data-plugin-css>
// in document.head). Colors come from DSH's theme tokens, so light and dark both work.

const STYLE_ID = '@fky/dsh-threads/styles'

const css = `
.dsht-page{box-sizing:border-box;height:100%;overflow:auto;padding:calc(var(--dsh-frame-top-clearance,0px) + 32px) 40px 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.dsht-inner{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.dsht-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dsht-title{margin:0;font-size:26px;line-height:34px;font-weight:600}
.dsht-subtitle{margin:4px 0 0;font-size:13px;line-height:19px;color:var(--dsw-alias-label-tertiary)}
.dsht-actions{display:flex;gap:8px;align-items:center;flex:none}
.dsht-select,.dsht-text,.dsht-textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px}
.dsht-select{height:32px;padding:0 8px}
.dsht-text{height:34px;padding:0 10px;width:100%}
.dsht-textarea{min-height:96px;padding:8px 10px;resize:vertical;width:100%;line-height:19px}
.dsht-select:focus-visible,.dsht-text:focus-visible,.dsht-textarea:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}
.dsht-search{position:relative}
.dsht-search svg{position:absolute;left:10px;top:9px;color:var(--dsw-alias-label-tertiary)}
.dsht-search .dsht-text{padding-left:32px;height:36px;border-radius:10px}
.dsht-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.dsht-card{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;min-height:118px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;outline:none}
.dsht-card:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsht-card:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dsht-card-icon{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsht-card-title{display:flex;align-items:center;gap:6px;font-size:15px;line-height:21px;font-weight:600;padding-right:56px;overflow-wrap:anywhere}
.dsht-card-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-card-folder{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-card-tools{position:absolute;top:10px;right:10px;display:flex;gap:2px}
.dsht-icon-button{width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.dsht-icon-button:hover,.dsht-icon-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsht-card:not(:hover):not(:focus-within) .dsht-hover-only{visibility:hidden}
.dsht-pinned{color:var(--dsw-alias-state-business-primary)}
.dsht-running{color:var(--dsw-alias-state-business-primary)}
.dsht-empty{padding:48px 16px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l2);border-radius:14px}
.dsht-error{font-size:13px;line-height:19px;color:var(--dsw-alias-state-error-primary)}
.dsht-form{display:flex;flex-direction:column;gap:14px}
.dsht-field{display:flex;flex-direction:column;gap:6px;font-size:13px}
.dsht-field-label{color:var(--dsw-alias-label-secondary)}
.dsht-hint{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-buttons{display:flex;justify-content:flex-end;gap:8px}
.dsht-tab{padding:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.dsht-chat{display:flex;flex-direction:column;height:100%;min-height:0}
.dsht-chat-body{flex:1;min-height:0;display:flex;flex-direction:column}
.dsht-pane-head{display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 8px 4px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:13px;flex:none}
.dsht-pane-title{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-pane-project{margin-left:6px;font-weight:400;color:var(--dsw-alias-label-tertiary)}
.dsht-list{display:flex;flex-direction:column;gap:2px;padding:6px 8px}
.dsht-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dsht-row{display:flex;gap:10px;align-items:flex-start;width:100%;padding:10px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dsht-row:hover,.dsht-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dsht-dot{margin-top:5px;flex:none}
.dsht-row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.dsht-row-title{font-size:13px;line-height:18px;font-weight:600;overflow-wrap:anywhere}
.dsht-row-summary{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsht-row-meta{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.dsht-resolved{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:0 auto 12px;padding:12px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);font-size:13px;line-height:19px;color:var(--dsw-alias-label-secondary)}
@media (max-width:640px){.dsht-page{padding-left:16px;padding-right:16px}.dsht-head{flex-direction:column}}
`

/** Add the stylesheet; returns a disposer that removes it. */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = '@fky/dsh-threads'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
