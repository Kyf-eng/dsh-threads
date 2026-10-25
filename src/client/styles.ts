// Plugin CSS, injected once like first-party client plugins do (a <style data-plugin-css>
// in document.head). Surfaces and text come from DSH's theme tokens, so light and dark both
// work; the few state colors (running, waiting, files, branches) are our own tokens below.

const STYLE_ID = '@kyf-eng/dsh-threads/styles'

const css = `
/* Fixed colors can live on :root. Tokens built from DSH's theme variables must be computed where
   those are defined (DSH sets them on body, not :root), so they are declared on body and again on
   our own elements, which may sit in a differently themed subtree. */
:root{
  --dsht-folder:#5b8def;
  --dsht-waiting:#e9a23b;
  --dsht-success:#2ea56f;
  --dsht-branch:#8a63d2;
  --dsht-file-doc:#2ea56f;
  --dsht-file-code:#4a8cf0;
  --dsht-file-data:#d9a13b;
  --dsht-ease:cubic-bezier(.2,.7,.2,1);
}
body,[class*="dsht-"]{
  --dsht-running:var(--dsw-alias-state-business-primary,#4d6bfe);
  --dsht-line:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);
  --dsht-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 4.5%,transparent);
  --dsht-press:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);
  --dsht-fill:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);
  --dsht-line-strong:color-mix(in srgb,var(--dsw-alias-label-primary) 15%,transparent);
  --dsht-line-hover:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);
  --dsht-field:color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent);
  --dsht-ring-soft:color-mix(in srgb,var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4d6bfe)) 18%,transparent);
  --dsht-ring:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4d6bfe));
}

/* State marks (glyphs.tsx) */
.dsht-glyph{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}
.dsht-glyph svg{width:16px;height:16px}
.dsht-glyph-waiting{color:var(--dsht-waiting)}
.dsht-glyph-failed{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsht-glyph-resolved{color:var(--dsht-success)}
/* Running: the dot itself breathes, dim to bright and back, in place (no spreading ring). */
.dsht-pulse{width:8px;height:8px;border-radius:50%;background:var(--dsht-running);animation:dsht-breathe 1.6s ease-in-out infinite}
@keyframes dsht-breathe{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.dsht-pulse{animation:none;opacity:.8}}

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
.dsht-replies{margin-top:10px;width:fit-content;min-width:min(100%,300px)}
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
.dsht-list{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;height:100%;min-height:0;overflow-y:auto;padding:8px 10px 16px}
.dsht-list-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding:0 2px 0 8px}
.dsht-list-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsht-list-tools{display:flex;align-items:center;gap:2px}
.dsht-list-search{box-sizing:border-box;height:32px;margin:-6px 4px 0;padding:0 11px;border:1px solid var(--dsht-line-strong);border-radius:9px;background:var(--dsht-field);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;transition:border-color .15s var(--dsht-ease),box-shadow .15s var(--dsht-ease)}
.dsht-list-search:focus{border-color:var(--dsht-ring);box-shadow:0 0 0 3px var(--dsht-ring-soft)}
.dsht-section{display:flex;flex-direction:column;gap:4px}
.dsht-section-head{display:flex;align-items:center;gap:6px;align-self:flex-start;padding:2px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;line-height:20px;cursor:pointer}
.dsht-section-head:not(:disabled):hover{color:var(--dsw-alias-label-secondary)}
.dsht-section-head:disabled{cursor:default}
.dsht-section-head svg{transform:rotate(-90deg);transition:transform .15s var(--dsht-ease)}
.dsht-section-head.is-open svg{transform:rotate(90deg)}
.dsht-section-empty{margin:2px 4px 0;padding:22px 14px;border:1px dashed var(--dsht-line-strong);border-radius:12px;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary)}
.dsht-rows{display:flex;flex-direction:column;gap:2px}
.dsht-row{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;outline:none;transition:background .15s var(--dsht-ease)}
.dsht-row:hover{background:var(--dsht-hover)}
.dsht-row:focus-visible{box-shadow:inset 0 0 0 2px var(--dsht-ring)}
.dsht-row>.dsht-glyph{margin-top:2px}
.dsht-row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.dsht-row-top{display:flex;align-items:baseline;gap:10px;min-width:0}
.dsht-row-title{flex:1;min-width:0;font-size:13.5px;font-weight:550;line-height:20px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-row-title .dsht-item-n{margin-right:6px}
.dsht-row-time{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dsht-row-decision{padding:6px 9px;border-radius:8px;background:color-mix(in srgb,var(--dsht-waiting) 11%,transparent);font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dsht-row-chips{display:flex;flex-wrap:wrap;gap:6px}
.dsht-count{border-radius:999px;padding:0 9px 0 7px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dsht-section-archived .dsht-row{opacity:.72}

.dsht-error{font-size:13px;line-height:19px;color:var(--dsw-alias-state-error-primary)}
.dsht-hint{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-buttons{display:flex;justify-content:flex-end;gap:8px}
.dsht-danger.dsht-danger{background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff}
.dsht-icon-button{width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s var(--dsht-ease),color .15s var(--dsht-ease)}
.dsht-icon-button:hover,.dsht-icon-button:focus-visible,.dsht-icon-button[aria-expanded="true"]{background:var(--dsht-press);color:var(--dsw-alias-label-primary)}
.dsht-icon-button:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-2px}

/* Menus (Menu items with two lines, or a value on the right) */
.dsht-menu-two{display:flex;flex-direction:column;gap:1px;min-width:0;text-align:left}
.dsht-menu-sub{max-width:320px;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-menu-aside-row{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%}
.dsht-menu-aside{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dsht-menu-icon-space{display:inline-block;width:16px;height:16px}

/* Dialogs: headless Modals; a doubled class beats the Modal defaults, as DSH's own dialogs do */
.dsht-dialog.dsht-dialog{gap:0;padding:0;overflow:hidden}
.dsht-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsht-dialog-title{margin:0;font-size:18px;line-height:26px;font-weight:600;letter-spacing:-.01em;color:var(--dsw-alias-label-primary)}
.dsht-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.dsht-np.dsht-np{width:min(480px,100%)}
.dsht-np-body{display:flex;flex-direction:column;gap:18px;padding:22px 24px 20px}
.dsht-np-field{display:flex;flex-direction:column;gap:8px}
.dsht-np-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsht-np-label{font-size:13px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.dsht-np-input{box-sizing:border-box;width:100%;height:42px;padding:0 14px;border:1px solid var(--dsht-line-strong);border-radius:10px;background:var(--dsht-field);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none;transition:border-color .15s var(--dsht-ease),box-shadow .15s var(--dsht-ease)}
.dsht-np-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dsht-np-input:focus{border-color:var(--dsht-ring);box-shadow:0 0 0 3px var(--dsht-ring-soft)}
.dsht-np-link{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;cursor:pointer}
.dsht-np-link:hover,.dsht-np-link:focus-visible{background:var(--dsht-hover);color:var(--dsw-alias-label-primary)}
.dsht-np-folder{box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:10px 14px;border:1px solid var(--dsht-line-strong);border-radius:12px;background:var(--dsht-field);color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;transition:background .15s var(--dsht-ease),border-color .15s var(--dsht-ease)}
.dsht-np-folder:hover{background:var(--dsht-hover);border-color:var(--dsht-line-hover)}
.dsht-np-folder:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:1px}
.dsht-np-folder>svg{flex:none;color:var(--dsht-folder)}
.dsht-np-folder-empty{justify-content:center;border-style:dashed}
.dsht-np-folder-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:14px}
.dsht-np-folder-empty .dsht-np-folder-text{flex:0 1 auto}
.dsht-np-folder-name{font-weight:550;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-np-folder-path{font-size:12px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-np-change{flex:none;font-size:12.5px;color:var(--dsw-alias-label-tertiary)}

/* Projects page */
.dsht-page{box-sizing:border-box;height:100%;overflow:auto;padding:calc(var(--dsh-frame-top-clearance,0px) + 36px) 40px 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.dsht-inner{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.dsht-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dsht-title{margin:0;font-size:28px;line-height:36px;font-weight:600;letter-spacing:-.015em}
.dsht-actions{display:flex;gap:8px;align-items:center;flex:none}
.dsht-select-button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid var(--dsht-line-strong);border-radius:9px;background:var(--dsht-field);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;transition:background .15s var(--dsht-ease)}
.dsht-select-button:hover,.dsht-select-button[aria-expanded="true"]{background:var(--dsht-hover)}
.dsht-select-label{color:var(--dsw-alias-label-tertiary)}
.dsht-split{display:inline-flex;align-items:stretch}
.dsht-split>button:first-child{border-top-right-radius:0;border-bottom-right-radius:0}
.dsht-split-more.dsht-split-more{margin-left:1px;padding-left:8px;padding-right:8px;border-top-left-radius:0;border-bottom-left-radius:0}
.dsht-text{box-sizing:border-box;width:100%;height:34px;padding:0 10px;border:1px solid var(--dsht-line-strong);border-radius:9px;background:var(--dsht-field);color:inherit;font:inherit;font-size:13px;transition:border-color .15s var(--dsht-ease)}
.dsht-text:hover{border-color:var(--dsht-line-hover)}
.dsht-text:focus-visible{outline:none;border-color:var(--dsht-ring);box-shadow:0 0 0 3px var(--dsht-ring-soft)}
.dsht-search{position:relative}
.dsht-search svg{position:absolute;left:12px;top:11px;color:var(--dsw-alias-label-tertiary)}
.dsht-search .dsht-text{padding-left:36px;height:40px;border-radius:11px}
.dsht-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.dsht-project{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;min-height:118px;padding:14px 12px 16px 16px;border:1px solid var(--dsht-line);border-radius:16px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:pointer;outline:none;transition:border-color .15s var(--dsht-ease),box-shadow .2s var(--dsht-ease),transform .2s var(--dsht-ease)}
.dsht-project:hover{border-color:var(--dsht-line-hover);box-shadow:0 6px 20px rgba(0,0,0,.08);transform:translateY(-1px)}
.dsht-project:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-2px}
.dsht-project.is-archived{cursor:default;opacity:.72}
.dsht-project.is-archived:hover{transform:none;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.dsht-project-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}
.dsht-project-icon{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsht-fill);color:var(--dsw-alias-label-secondary)}
.dsht-project-tools{display:flex;opacity:0;transition:opacity .15s var(--dsht-ease)}
.dsht-project-tools .dsht-icon-button svg{transform:rotate(90deg)}
.dsht-project:hover .dsht-project-tools,.dsht-project:focus-within .dsht-project-tools,.dsht-project.is-menu-open .dsht-project-tools{opacity:1}
.dsht-project-title{display:flex;align-items:center;gap:6px;min-width:0;padding-right:4px;font-size:15px;line-height:21px;font-weight:600}
.dsht-project-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-pin-on{flex:none;color:var(--dsht-running)}
.dsht-project-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-running{display:inline-flex;align-items:center;gap:5px;color:var(--dsht-running)}
.dsht-empty{padding:56px 24px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsht-line-strong);border-radius:16px}
.dsht-archived{display:flex;flex-direction:column;gap:12px;margin-top:8px}
.dsht-archived-toggle{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;cursor:pointer}
.dsht-archived-toggle:hover,.dsht-archived-toggle:focus-visible{background:var(--dsht-hover);color:var(--dsw-alias-label-primary)}
.dsht-rotate{transform:rotate(-90deg)}
.dsht-row-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}

/* Sidebar "Projects" section (SidebarProjects.tsx), measured against DSH's own workspace list:
   36px section header in tertiary 14px text, 32px rows with a 16px leading cell. */
.dsht-panel-icon{display:inline-flex}
.dsht-side{flex:none;display:flex;flex-direction:column;min-height:0;max-height:42%;margin-bottom:4px}
.dsht-side-head{box-sizing:border-box;flex:none;display:flex;align-items:center;gap:4px;height:36px;margin:2px -4px 4px 0;padding-left:4px;color:var(--dsw-alias-label-tertiary)}
.dsht-side-label{flex:1;min-width:0;display:inline-flex;align-items:center;gap:4px;height:28px;padding:0;border:0;background:none;color:inherit;font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer}
.dsht-side-label svg{flex:none;opacity:0;transition:opacity .12s var(--dsht-ease),transform .15s var(--dsht-ease)}
.dsht-side-head:hover .dsht-side-label svg,.dsht-side-label:focus-visible svg,.dsht-side-label svg.dsht-rotate{opacity:1}
.dsht-side-label:focus-visible,.dsht-side-icon:focus-visible,.dsht-side-more:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-2px;border-radius:var(--dsw-radius-sm,6px)}
.dsht-side-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm,6px);background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsht-side-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsht-side-list{display:flex;flex-direction:column;min-height:0;overflow-y:auto}
.dsht-side-row{box-sizing:border-box;flex:none;display:flex;align-items:center;height:32px;padding:0 8px;border-radius:var(--dsw-radius-md,10px);color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none}
.dsht-side-row:hover,.dsht-side-row.is-selected,.dsht-side-row.is-menu-open{background:var(--dsw-alias-interactive-bg-hover)}
.dsht-side-row:focus-visible{outline:2px solid var(--dsht-ring);outline-offset:-2px}
.dsht-side-slot{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.dsht-side-title{flex:1;min-width:0;margin:0 6px 0 4px;font-size:14px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsht-side-meta{flex:none;display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.dsht-side-actions{flex:none;display:none;margin-right:-4px}
.dsht-side-actions .dsht-icon-button{width:24px;height:24px;border-radius:6px}
.dsht-side-row:hover .dsht-side-meta,.dsht-side-row.is-menu-open .dsht-side-meta{display:none}
.dsht-side-row:hover .dsht-side-actions,.dsht-side-row.is-menu-open .dsht-side-actions{display:inline-flex}
.dsht-side-more{box-sizing:border-box;flex:none;display:flex;align-items:center;height:32px;padding:0 8px 0 28px;border:0;border-radius:var(--dsw-radius-md,10px);background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.dsht-side-more:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}

/* Project settings */
.dsht-settings.dsht-settings{width:min(820px,100%);height:min(620px,100dvh - 48px)}
.dsht-settings-layout{display:flex;height:100%;min-height:0}
.dsht-settings-nav{box-sizing:border-box;flex:none;width:200px;padding:18px 10px;display:flex;flex-direction:column;gap:2px;border-right:1px solid var(--dsht-line);background:var(--dsht-field)}
.dsht-settings-nav-title{padding:2px 10px 12px;font-size:13px;color:var(--dsw-alias-label-tertiary)}
.dsht-settings-nav-item{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;text-align:left;cursor:pointer;transition:background .15s var(--dsht-ease)}
.dsht-settings-nav-item:hover,.dsht-settings-nav-item:focus-visible{background:var(--dsht-hover);color:var(--dsw-alias-label-primary)}
.dsht-settings-nav-item.is-active{background:var(--dsht-press);color:var(--dsw-alias-label-primary);font-weight:550}
.dsht-settings-main{flex:1;min-width:0;display:flex;flex-direction:column}
.dsht-settings-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 6px 32px}
.dsht-settings-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:4px 32px 28px}
.dsht-setting-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:1px solid var(--dsht-line)}
.dsht-setting-text{min-width:0;display:flex;flex-direction:column;gap:3px}
.dsht-setting-title{font-size:14px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsht-setting-hint{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsht-setting-block{display:flex;flex-direction:column;gap:4px;padding:16px 0;border-bottom:1px solid var(--dsht-line)}
.dsht-setting-textarea{box-sizing:border-box;width:100%;min-height:112px;margin-top:8px;padding:10px 12px;border:1px solid var(--dsht-line-strong);border-radius:10px;background:var(--dsht-field);color:inherit;font:inherit;font-size:13.5px;line-height:20px;resize:vertical;outline:none;transition:border-color .15s var(--dsht-ease),box-shadow .15s var(--dsht-ease)}
.dsht-setting-textarea::placeholder{color:var(--dsw-alias-label-tertiary)}
.dsht-setting-textarea:focus{border-color:var(--dsht-ring);box-shadow:0 0 0 3px var(--dsht-ring-soft)}
.dsht-setting-textarea-tall{min-height:240px}
.dsht-counter{align-self:flex-end;font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dsht-setting-group{display:flex;flex-direction:column;padding-top:20px}
.dsht-setting-group-title{padding-bottom:2px;font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsht-select-box{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:space-between;gap:10px;width:248px;height:38px;padding:0 12px;border:1px solid var(--dsht-line-strong);border-radius:10px;background:var(--dsht-field);color:var(--dsw-alias-label-primary);font:inherit;font-size:13.5px;text-align:left;cursor:pointer;transition:background .15s var(--dsht-ease),border-color .15s var(--dsht-ease)}
.dsht-select-box:hover:enabled,.dsht-select-box[aria-expanded="true"]{background:var(--dsht-hover);border-color:var(--dsht-line-hover)}
.dsht-select-box:disabled{cursor:default;color:var(--dsw-alias-label-tertiary)}
.dsht-select-box svg{flex:none;color:var(--dsw-alias-label-tertiary)}
.dsht-select-box-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-usage-loading{padding:16px 0}
.dsht-usage-total{display:flex;gap:40px;margin:14px 0 6px}
.dsht-usage-total>div{display:flex;flex-direction:column;gap:2px}
.dsht-usage-figure{font-size:24px;line-height:30px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.dsht-usage-table{width:100%;margin-top:10px;border-collapse:collapse;font-size:13px}
.dsht-usage-table th{padding:8px 0;border-bottom:1px solid var(--dsht-line);font-weight:500;font-size:12px;color:var(--dsw-alias-label-tertiary);text-align:right}
.dsht-usage-table td{padding:9px 0;border-bottom:1px solid var(--dsht-line);text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dsht-usage-table th:first-child,.dsht-usage-table td:first-child{text-align:left;color:var(--dsw-alias-label-primary)}
.dsht-usage-table td:first-child .dsht-item-n{margin-right:6px}
.dsht-setting-path{box-sizing:border-box;margin-top:8px;padding:9px 12px;border:1px solid var(--dsht-line);border-radius:10px;background:var(--dsht-field);font-size:12.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsht-name-field{display:flex;align-items:center;flex:none;width:min(340px,100%);height:40px;border:1px solid var(--dsht-line-strong);border-radius:10px;background:var(--dsht-field);overflow:hidden;transition:border-color .15s var(--dsht-ease),box-shadow .15s var(--dsht-ease)}
.dsht-name-field:focus-within{border-color:var(--dsht-ring);box-shadow:0 0 0 3px var(--dsht-ring-soft)}
.dsht-icon-pick{flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:100%;border:0;border-right:1px solid var(--dsht-line);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsht-icon-pick:hover,.dsht-icon-pick[aria-expanded="true"]{background:var(--dsht-hover);color:var(--dsw-alias-label-primary)}
.dsht-name-input{flex:1;min-width:0;height:100%;padding:0 12px;border:0;background:transparent;color:inherit;font:inherit;font-size:14px;outline:none}
.dsht-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:6px;margin:12px 0 4px;padding:12px;border:1px solid var(--dsht-line);border-radius:12px;background:var(--dsht-field)}
.dsht-icon-cell{display:inline-flex;align-items:center;justify-content:center;height:40px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s var(--dsht-ease)}
.dsht-icon-cell:hover,.dsht-icon-cell:focus-visible{background:var(--dsht-hover);color:var(--dsw-alias-label-primary)}
.dsht-icon-cell.is-active{background:var(--dsht-press);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1.5px var(--dsht-ring)}

@media (max-width:640px){.dsht-page{padding-left:16px;padding-right:16px}.dsht-head{flex-direction:column;align-items:flex-start}.dsht-card{max-width:none}.dsht-settings-layout{flex-direction:column}.dsht-settings-nav{width:auto;flex-direction:row;border-right:0;border-bottom:1px solid var(--dsht-line)}.dsht-settings-nav-title{display:none}.dsht-settings-head,.dsht-settings-body{padding-left:20px;padding-right:20px}}
`

/** Add the stylesheet; returns a disposer that removes it. */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = '@kyf-eng/dsh-threads'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
