// Plugin CSS, injected once like first-party client plugins do (a <style data-plugin-css>
// in document.head). Surfaces and text come from DSH's theme tokens, so light and dark both
// work; the few state colors (running, waiting, files, branches) are our own tokens below.

const STYLE_ID = '@fky/dsh-threads/styles'

const css = `
:root{
  --dsht-running:var(--dsw-alias-state-business-primary,#4d6bfe);
  --dsht-waiting:#e9a23b;
  --dsht-success:#2ea56f;
  --dsht-branch:#8a63d2;
  --dsht-file-doc:#2ea56f;
  --dsht-file-code:#4a8cf0;
  --dsht-file-data:#d9a13b;
  --dsht-line:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent);
  --dsht-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 4.5%,transparent);
  --dsht-press:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);
  --dsht-fill:color-mix(in srgb,var(--dsw-alias-label-primary) 11%,transparent);
  --dsht-ring:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));
  --dsht-ease:cubic-bezier(.2,.7,.2,1);
}

/* State marks (glyphs.tsx) */
.dsht-glyph{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}
.dsht-glyph svg{width:16px;height:16px}
.dsht-glyph-waiting{color:var(--dsht-waiting)}
.dsht-glyph-failed{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsht-glyph-resolved{color:var(--dsht-success)}
.dsht-pulse{position:relative;width:8px;height:8px;border-radius:50%;background:var(--dsht-running)}
.dsht-pulse::after{content:"";position:absolute;inset:-3px;border-radius:50%;background:var(--dsht-running);opacity:.28;animation:dsht-breathe 1.9s var(--dsht-ease) infinite}
@keyframes dsht-breathe{0%{transform:scale(.55);opacity:.42}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}
@media (prefers-reduced-motion:reduce){.dsht-pulse::after{animation:none;opacity:.2}}

/* Kit (ui.tsx) */
.dsht-mono{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.94em}
.dsht-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.dsht-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;max-width:240px;height:22px;padding:0 8px 0 6px;border:1px solid var(--dsht-line);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 2.5%,transparent);font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsht-chip svg{flex:none}
.dsht-chip-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-file-doc svg{color:var(--dsht-file-doc)}
.dsht-file-code svg{color:var(--dsht-file-code)}
.dsht-file-data svg{color:var(--dsht-file-data)}
.dsht-file-other svg{color:var(--dsw-alias-label-tertiary)}
.dsht-branch{border-color:color-mix(in srgb,var(--dsht-branch) 28%,transparent);background:color-mix(in srgb,var(--dsht-branch) 9%,transparent);color:var(--dsw-alias-label-primary)}
.dsht-branch svg{color:var(--dsht-branch)}
.dsht-branch-removed{opacity:.55;text-decoration:line-through}
.dsht-tag{display:inline-flex;align-items:center;gap:3px;margin-left:8px;padding:0 6px;height:18px;border-radius:5px;background:color-mix(in srgb,var(--dsht-branch) 10%,transparent);color:var(--dsht-branch);font-size:11px;font-weight:500;vertical-align:1px}
.dsht-pill{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:26px;padding:0 10px;border:0;border-radius:8px;background:var(--dsht-fill);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .15s var(--dsht-ease),opacity .15s var(--dsht-ease)}
.dsht-pill:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent)}
.dsht-pill:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:1px}
.dsht-pill:disabled{opacity:.45;cursor:default}
.dsht-pill-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}
.dsht-pill-primary:hover{background:var(--dsw-alias-label-primary);opacity:.88}
.dsht-pill-icon{width:26px;padding:0;background:transparent;color:var(--dsw-alias-label-secondary)}
.dsht-pill-icon:hover{background:var(--dsht-press);color:var(--dsw-alias-label-primary)}
.dsht-head-label{display:flex;align-items:center;gap:6px;padding:6px 10px 4px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-head-label svg{flex:none}
.dsht-head-trailing{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* A thread, wherever it appears */
.dsht-items{display:flex;flex-direction:column;gap:2px}
.dsht-item{position:relative;display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;outline:none;transition:background .15s var(--dsht-ease)}
.dsht-item:hover{background:var(--dsht-hover)}
.dsht-item:focus-visible{box-shadow:inset 0 0 0 2px var(--dsht-ring)}
.dsht-item>.dsht-glyph{margin-top:2px}
.dsht-item-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.dsht-item-title{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:13.5px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsht-item-n{flex:none;margin-right:4px;color:var(--dsw-alias-label-tertiary);font-weight:400;font-variant-numeric:tabular-nums}
.dsht-item-title .dsht-item-n{margin-right:0}
.dsht-item-name{min-width:0;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-item-status{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dsht-item-status::before{content:"·";margin-right:6px}
.dsht-item-summary{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.dsht-item-decision{padding:6px 9px;border-radius:8px;background:color-mix(in srgb,var(--dsht-waiting) 11%,transparent);font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.dsht-item-decision b{font-weight:550;color:var(--dsht-waiting)}
.dsht-item-chevron{flex:none;align-self:center;display:inline-flex;color:var(--dsw-alias-label-tertiary);opacity:0;transform:translateX(-2px);transition:opacity .15s var(--dsht-ease),transform .15s var(--dsht-ease)}
.dsht-item:hover .dsht-item-chevron,.dsht-item:focus-visible .dsht-item-chevron{opacity:1;transform:none}
.dsht-item>.dsht-pill{align-self:center}
.dsht-item-compact{align-items:center;padding:7px 10px}
.dsht-item-compact>.dsht-glyph{margin-top:0}
.dsht-item-compact .dsht-item-body{flex-direction:row;align-items:center;gap:10px}
.dsht-item-compact .dsht-item-title{flex:0 1 auto;min-width:0}
.dsht-item-compact .dsht-chips{flex:0 1 auto;min-width:0;margin-top:0;flex-wrap:nowrap;overflow:hidden}

/* Cards in the transcript and above the composer */
.dsht-card{box-sizing:border-box;max-width:640px;margin:8px 0;padding:4px;border:1px solid var(--dsht-line);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.04);font-size:13px}
.dsht-replies{margin-top:10px}
.dsht-card-foot{display:flex;justify-content:flex-end;gap:6px;margin-top:2px;padding:8px 8px 6px;border-top:1px solid var(--dsht-line)}
.dsht-brief{padding-bottom:8px}
.dsht-brief-text{display:block;width:100%;padding:2px 10px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer;border-radius:8px}
.dsht-brief-text:focus-visible{outline:2px solid var(--dsht-ring)}
.dsht-clamped{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

/* Proposals */
.dsht-proposals{max-width:none;margin:0 0 8px}
.dsht-proposal-list{display:flex;flex-direction:column;gap:2px}
.dsht-proposal{display:flex;align-items:center;gap:8px;padding:8px 6px 8px 10px;border-radius:10px;transition:background .15s var(--dsht-ease)}
.dsht-proposal:hover{background:var(--dsht-hover)}
.dsht-proposal-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsht-proposal-title{font-size:13.5px;line-height:20px;font-weight:550;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-proposal-task{display:flex;align-items:center;gap:6px;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-proposal-task .dsht-glyph,.dsht-proposal-task .dsht-glyph svg{width:14px;height:14px}
.dsht-proposal-actions{display:flex;gap:2px;flex:none}
.dsht-proposal-actions .dsht-pill-icon:first-child{opacity:0;transition:opacity .15s var(--dsht-ease)}
.dsht-proposal:hover .dsht-proposal-actions .dsht-pill-icon:first-child,.dsht-proposal-actions .dsht-pill-icon:first-child:focus-visible{opacity:1}
.dsht-proposal-queued .dsht-proposal-title{color:var(--dsw-alias-label-secondary)}

/* Thread pane (right sidebar) */
.dsht-chat{display:flex;flex-direction:column;height:100%;min-height:0}
.dsht-chat-body{flex:1;min-height:0;display:flex;flex-direction:column}
.dsht-pane-head{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 10px 6px 14px;border-bottom:1px solid var(--dsht-line);flex:none}
.dsht-pane-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsht-pane-title{font-size:13.5px;line-height:19px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-pane-title .dsht-item-n{margin-right:6px}
.dsht-pane-meta{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-pane-meta>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-pane-meta .dsht-chip{height:20px}
.dsht-pane-actions{display:flex;gap:4px;flex:none}
.dsht-pane-actions .dsht-pill{background:transparent;color:var(--dsw-alias-label-secondary)}
.dsht-pane-actions .dsht-pill:hover{background:var(--dsht-press);color:var(--dsw-alias-label-primary)}
.dsht-resolved{box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;margin:0 auto 12px;padding:10px 10px 10px 14px;border:1px solid var(--dsht-line);border-radius:16px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.04);font-size:13px;line-height:19px}
.dsht-resolved-text{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary)}
.dsht-resolved-text b{margin-right:4px;font-weight:550;color:var(--dsw-alias-label-primary)}

/* Thread list tab */
.dsht-tab{padding:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.dsht-list{display:flex;flex-direction:column;gap:4px;padding:6px 8px}
.dsht-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 10px 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}

/* Projects page */
.dsht-page{box-sizing:border-box;height:100%;overflow:auto;padding:calc(var(--dsh-frame-top-clearance,0px) + 36px) 40px 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.dsht-inner{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.dsht-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.dsht-title{margin:0;font-size:26px;line-height:34px;font-weight:600;letter-spacing:-.01em}
.dsht-subtitle{margin:4px 0 0;font-size:13px;line-height:19px;color:var(--dsw-alias-label-tertiary)}
.dsht-actions{display:flex;gap:8px;align-items:center;flex:none}
.dsht-select,.dsht-text,.dsht-textarea{box-sizing:border-box;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 15%,transparent);border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent);color:inherit;font:inherit;font-size:13px;transition:border-color .15s var(--dsht-ease)}
.dsht-select:hover,.dsht-text:hover,.dsht-textarea:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent)}
.dsht-select{height:32px;padding:0 8px}
.dsht-text{height:34px;padding:0 10px;width:100%}
.dsht-textarea{min-height:96px;padding:8px 10px;resize:vertical;width:100%;line-height:19px}
.dsht-select:focus-visible,.dsht-text:focus-visible,.dsht-textarea:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-1px}
.dsht-search{position:relative}
.dsht-search svg{position:absolute;left:11px;top:10px;color:var(--dsw-alias-label-tertiary)}
.dsht-search .dsht-text{padding-left:34px;height:38px;border-radius:11px}
.dsht-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.dsht-project{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;min-height:124px;padding:16px;border:1px solid var(--dsht-line);border-radius:16px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;outline:none;transition:border-color .15s var(--dsht-ease),box-shadow .2s var(--dsht-ease),transform .2s var(--dsht-ease)}
.dsht-project:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent);box-shadow:0 6px 20px rgba(0,0,0,.08);transform:translateY(-1px)}
.dsht-project:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-2px}
.dsht-project-icon{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsht-fill);color:var(--dsw-alias-label-secondary)}
.dsht-project-title{display:flex;align-items:center;gap:6px;font-size:15px;line-height:21px;font-weight:600;padding-right:56px;overflow-wrap:anywhere}
.dsht-project-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-project-folder{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-project-tools{position:absolute;top:12px;right:12px;display:flex;gap:2px}
.dsht-icon-button{width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.dsht-icon-button:hover,.dsht-icon-button:focus-visible{background:var(--dsht-press);color:var(--dsw-alias-label-primary)}
.dsht-project:not(:hover):not(:focus-within) .dsht-hover-only{visibility:hidden}
.dsht-pinned{color:var(--dsw-alias-label-secondary)}
.dsht-running{display:inline-flex;align-items:center;gap:5px;color:var(--dsht-running)}
.dsht-empty{padding:56px 16px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsht-line);border-radius:16px}
.dsht-error{font-size:13px;line-height:19px;color:var(--dsw-alias-state-error-primary)}
.dsht-form{display:flex;flex-direction:column;gap:14px}
.dsht-field{display:flex;flex-direction:column;gap:6px;font-size:13px}
.dsht-field-label{color:var(--dsw-alias-label-secondary)}
.dsht-hint{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-buttons{display:flex;justify-content:flex-end;gap:8px}

@media (max-width:640px){.dsht-page{padding-left:16px;padding-right:16px}.dsht-head{flex-direction:column;align-items:flex-start}.dsht-card{max-width:none}}
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
