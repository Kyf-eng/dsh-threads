window.__ModuleLoader__.load({
	id: "@fky/dsh-threads",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react_jsx_runtime = require("react/jsx-runtime");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react = require("react");
// src/client/icons.tsx
function Svg({ size = 16, children, ...rest }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.6,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		...rest,
		children
	});
}
function ProjectsIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 13h8M8 16h5" })]
	});
}
function FolderIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" })
	});
}
function PinIcon({ filled, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "M14.5 3.5 20.5 9.5 17 11l-3.5 3.5.5 4-1.5 1.5-4-4-4.5 4.5M8.5 11.5 4 7l1.5-1.5 4 .5L13 2.5z",
			fill: filled ? "currentColor" : "none"
		})
	});
}
function PlusIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" })
	});
}
function TrashIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5" })
	});
}
function SearchIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "11",
			cy: "11",
			r: "6.5"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m20 20-4.2-4.2" })]
	});
}
// src/client/locale.ts
/** Locale namespace for every string this plugin shows. */
const NS = "dshThreads";
const zh = {
	"panel": "项目",
	"page.title": "项目",
	"page.subtitle": "一个项目 = 一个文件夹 + 一个主对话。主对话可以把任务派给讨论串。",
	"page.new": "新建项目",
	"page.search": "搜索项目…",
	"page.sort.activity": "最近活动",
	"page.sort.created": "创建时间",
	"page.sort.title": "名称",
	"page.empty": "还没有项目。新建一个，或者在左侧会话的\"…\"菜单里选\"设为项目\"。",
	"page.noMatch": "没有匹配的项目。",
	"page.loadFailed": "读取项目失败：{error}",
	"card.threads": "{count} 个讨论串",
	"card.running": "{count} 个运行中",
	"card.pin": "置顶",
	"card.unpin": "取消置顶",
	"card.remove": "移除项目",
	"remove.title": "移除项目「{title}」？",
	"remove.description": "只移除项目记录。主对话和讨论串会保留为普通会话。",
	"remove.confirm": "移除",
	"common.cancel": "取消",
	"common.close": "关闭",
	"new.title": "新建项目",
	"new.name": "项目名",
	"new.namePlaceholder": "例如：Vetoarc",
	"new.folder": "文件夹（工作区）",
	"new.noFolders": "还没有工作区。先在左侧\"工作区\"里添加一个文件夹。",
	"new.instructions": "项目说明（可选）",
	"new.instructionsPlaceholder": "会加进主对话和所有讨论串的系统提示，例如代码规范、回复语言。",
	"new.create": "创建并打开",
	"new.failed": "创建失败：{error}",
	"menu.makeProject": "设为项目",
	"time.justNow": "刚刚",
	"time.minutes": "{count} 分钟前",
	"time.hours": "{count} 小时前",
	"time.days": "{count} 天前",
	"tab.title": "讨论串",
	"tab.description": "主对话开出的讨论串"
};
const en = {
	"panel": "Projects",
	"page.title": "Projects",
	"page.subtitle": "A project is one folder and one main conversation. The main conversation can hand tasks to threads.",
	"page.new": "New project",
	"page.search": "Search projects…",
	"page.sort.activity": "Recent activity",
	"page.sort.created": "Date created",
	"page.sort.title": "Name",
	"page.empty": "No projects yet. Create one, or choose \"Make project\" in a conversation's \"…\" menu.",
	"page.noMatch": "No matching projects.",
	"page.loadFailed": "Could not load projects: {error}",
	"card.threads": "{count} threads",
	"card.running": "{count} running",
	"card.pin": "Pin",
	"card.unpin": "Unpin",
	"card.remove": "Remove project",
	"remove.title": "Remove project \"{title}\"?",
	"remove.description": "Only the project record is removed. Its main conversation and threads stay as ordinary conversations.",
	"remove.confirm": "Remove",
	"common.cancel": "Cancel",
	"common.close": "Close",
	"new.title": "New project",
	"new.name": "Name",
	"new.namePlaceholder": "e.g. Vetoarc",
	"new.folder": "Folder (workspace)",
	"new.noFolders": "No workspaces yet. Add a folder under Workspaces in the sidebar first.",
	"new.instructions": "Project instructions (optional)",
	"new.instructionsPlaceholder": "Added to the system prompt of the main conversation and every thread: conventions, reply language, …",
	"new.create": "Create and open",
	"new.failed": "Could not create the project: {error}",
	"menu.makeProject": "Make project",
	"time.justNow": "just now",
	"time.minutes": "{count} min ago",
	"time.hours": "{count} h ago",
	"time.days": "{count} d ago",
	"tab.title": "Threads",
	"tab.description": "Threads opened by the main conversation"
};
/** Relative time like "3 天前", from an ISO timestamp. */
function relativeTime(t, iso, now = Date.now()) {
	const minutes = Math.floor((now - Date.parse(iso)) / 6e4);
	if (!Number.isFinite(minutes) || minutes < 1) return t("time.justNow");
	if (minutes < 60) return t("time.minutes", { count: minutes });
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return t("time.hours", { count: hours });
	return t("time.days", { count: Math.floor(hours / 24) });
}
// src/client/api.ts
/**
* Host route, relative to the page like DSH's own Connection calls: on Desktop the page is
* dsh-app://app/ and the shell forwards it to the Host with its cookie; on Web it is same-origin.
* Must match RPC_PATH in src/rpc.ts.
*/
const RPC_URL = "api/dsh-threads";
async function callHost(method, payload = {}) {
	const response = await fetch(RPC_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			method,
			payload
		})
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error((body.error ?? `HTTP ${response.status}`).replace(/^(Project|Thread)?Error: /, ""));
	return body.result;
}
let state = {
	status: "idle",
	projects: [],
	error: null
};
const listeners = /* @__PURE__ */ new Set();
let inflight = null;
function publish(next) {
	state = next;
	for (const listener of listeners) listener();
}
const projectsStore = {
	getSnapshot: () => state,
	subscribe(listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	/** Reload from the host; concurrent calls share one request. */
	refresh() {
		if (inflight !== null) return inflight;
		if (state.status === "idle") publish({
			...state,
			status: "loading"
		});
		inflight = callHost("projects.list").then((projects) => publish({
			status: "ready",
			projects,
			error: null
		})).catch((error) => publish({
			...state,
			status: "error",
			error: error instanceof Error ? error.message : String(error)
		})).finally(() => {
			inflight = null;
		});
		return inflight;
	}
};
function useProjects() {
	return (0, react.useSyncExternalStore)(projectsStore.subscribe, projectsStore.getSnapshot);
}
// src/client/MakeProjectMenuItem.tsx
/** "设为项目" in a session's "…" menu; hidden for threads and sessions that already are projects. */
function MakeProjectMenuItem({ sessionId, displayTitle, useMenuOpenState, t, showProjects }) {
	const [, setMenuOpen] = useMenuOpenState();
	const [eligible, setEligible] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		let live = true;
		callHost("sessions.role", { id: sessionId }).then((role) => {
			if (live) setEligible(role.project === null && !role.thread);
		}, () => {
			if (live) setEligible(false);
		});
		return () => {
			live = false;
		};
	}, [sessionId]);
	if (!eligible) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectsIcon, { size: 16 }),
		onSelect: () => {
			setMenuOpen(false);
			callHost("projects.create", {
				title: displayTitle,
				fromSessionId: sessionId
			}).then(() => projectsStore.refresh()).then(showProjects);
		},
		children: t("menu.makeProject")
	});
}
// src/client/NewProjectDialog.tsx
function NewProjectDialog({ open, onClose, onCreated, workspaces, t }) {
	const [title, setTitle] = (0, react.useState)("");
	const [workspaceId, setWorkspaceId] = (0, react.useState)("");
	const [instructions, setInstructions] = (0, react.useState)("");
	const [error, setError] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	const folder = workspaceId || workspaces[0]?.workspaceId || "";
	const submit = async () => {
		setBusy(true);
		setError(null);
		try {
			const project = await callHost("projects.create", {
				title,
				workspaceId: folder,
				instructions
			});
			await projectsStore.refresh();
			setTitle("");
			setInstructions("");
			onCreated(project);
		} catch (failure) {
			setError(t("new.failed", { error: failure instanceof Error ? failure.message : String(failure) }));
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
		open,
		onClose,
		title: t("new.title"),
		closeLabel: t("common.close"),
		footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-buttons",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				onClick: onClose,
				children: t("common.cancel")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				disabled: busy || title.trim().length === 0 || folder.length === 0,
				onClick: () => {
					submit();
				},
				children: t("new.create")
			})]
		}),
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dsht-form",
			onSubmit: (event) => {
				event.preventDefault();
				submit();
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsht-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-field-label",
						children: t("new.name")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "dsht-text",
						value: title,
						placeholder: t("new.namePlaceholder"),
						"data-modal-autofocus": true,
						onChange: (event) => setTitle(event.target.value),
						maxLength: 60
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsht-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-field-label",
						children: t("new.folder")
					}), workspaces.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-hint",
						children: t("new.noFolders")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: "dsht-select",
						value: folder,
						onChange: (event) => setWorkspaceId(event.target.value),
						children: workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
							value: workspace.workspaceId,
							children: [
								workspace.title,
								" — ",
								workspace.path
							]
						}, workspace.workspaceId))
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsht-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-field-label",
						children: t("new.instructions")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: "dsht-textarea",
						value: instructions,
						placeholder: t("new.instructionsPlaceholder"),
						onChange: (event) => setInstructions(event.target.value),
						maxLength: 4e3
					})]
				}),
				error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsht-error",
					children: error
				})
			]
		})
	});
}
// src/client/ProjectsPage.tsx
const sameList = (a, b) => a.length === b.length && a.every((item, index) => item.workspaceId === b[index]?.workspaceId && item.title === b[index]?.title);
function sortProjects(projects, sort) {
	const key = (p) => sort === "created" ? p.createdAt : p.lastActivity;
	return [...projects].sort((a, b) => {
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		if (sort === "title") return a.title.localeCompare(b.title);
		return key(b).localeCompare(key(a));
	});
}
function ProjectsPage({ t, useWorkspaces, useSessionStatus, openSession, pinSession }) {
	const { status, projects, error } = useProjects();
	const [query, setQuery] = (0, react.useState)("");
	const [sort, setSort] = (0, react.useState)("activity");
	const [creating, setCreating] = (0, react.useState)(false);
	const [removing, setRemoving] = (0, react.useState)(null);
	const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList);
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running).map(([id]) => id).sort().join(","));
	(0, react.useEffect)(() => {
		projectsStore.refresh();
	}, [runningKey]);
	const visible = (0, react.useMemo)(() => {
		const needle = query.trim().toLowerCase();
		return sortProjects(needle.length === 0 ? projects : projects.filter((p) => p.title.toLowerCase().includes(needle) || p.folder.toLowerCase().includes(needle)), sort);
	}, [
		projects,
		query,
		sort
	]);
	const togglePin = async (project) => {
		await callHost("projects.pin", {
			id: project.id,
			pinned: !project.pinned
		});
		await pinSession(project.mainSessionId, !project.pinned).catch(() => {});
		await projectsStore.refresh();
	};
	const remove = async (project) => {
		await callHost("projects.remove", { id: project.id });
		if (project.pinned) await pinSession(project.mainSessionId, false).catch(() => {});
		setRemoving(null);
		await projectsStore.refresh();
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-page",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-inner",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: "dsht-title",
							children: t("page.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsht-subtitle",
							children: t("page.subtitle")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsht-select",
								value: sort,
								onChange: (event) => setSort(event.target.value),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "activity",
										children: t("page.sort.activity")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "created",
										children: t("page.sort.created")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "title",
										children: t("page.sort.title")
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlusIcon, { size: 14 }),
								onClick: () => setCreating(true),
								children: t("page.new")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-search",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchIcon, { size: 16 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dsht-text",
							value: query,
							placeholder: t("page.search"),
							onChange: (event) => setQuery(event.target.value)
						})]
					}),
					status === "error" && error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-error",
						children: t("page.loadFailed", { error })
					}) : null,
					visible.length === 0 ? status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-empty",
						children: projects.length === 0 ? t("page.empty") : t("page.noMatch")
					}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-grid",
						children: visible.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-card",
							role: "button",
							tabIndex: 0,
							onClick: () => openSession(project.mainSessionId),
							onKeyDown: (event) => {
								if (event.key === "Enter") openSession(project.mainSessionId);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsht-card-icon",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderIcon, { size: 16 })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsht-card-title",
									children: [project.title, project.pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PinIcon, {
										size: 13,
										filled: true,
										className: "dsht-pinned"
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsht-card-meta",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: relativeTime(t, project.lastActivity) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.threads", { count: project.threads }) }),
										project.running > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsht-running",
											children: t("card.running", { count: project.running })
										}) : null
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-card-folder",
									title: project.folder,
									children: project.folder
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsht-card-tools",
									onClick: (event) => event.stopPropagation(),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `dsht-icon-button ${project.pinned ? "" : "dsht-hover-only"}`,
										title: project.pinned ? t("card.unpin") : t("card.pin"),
										"aria-label": project.pinned ? t("card.unpin") : t("card.pin"),
										onClick: () => {
											togglePin(project);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PinIcon, {
											size: 14,
											filled: project.pinned
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsht-icon-button dsht-hover-only",
										title: t("card.remove"),
										"aria-label": t("card.remove"),
										onClick: () => setRemoving(project),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrashIcon, { size: 14 })
									})]
								})
							]
						}, project.id))
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewProjectDialog, {
				open: creating,
				onClose: () => setCreating(false),
				onCreated: (project) => {
					setCreating(false);
					openSession(project.mainSessionId);
				},
				workspaces,
				t
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: removing !== null,
				onClose: () => setRemoving(null),
				title: removing === null ? "" : t("remove.title", { title: removing.title }),
				description: t("remove.description"),
				closeLabel: t("common.close"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-buttons",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: () => setRemoving(null),
						children: t("common.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						onClick: () => {
							if (removing !== null) remove(removing);
						},
						children: t("remove.confirm")
					})]
				})
			})
		]
	});
}
// src/client/styles.ts
const STYLE_ID = "@fky/dsh-threads/styles";
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
.dsht-tab{padding:12px;font-size:13px;line-height:1.6}
@media (max-width:640px){.dsht-page{padding-left:16px;padding-right:16px}.dsht-head{flex-direction:column}}
`;
/** Add the stylesheet; returns a disposer that removes it. */
function injectStyles() {
	if (typeof document === "undefined") return () => {};
	if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {};
	const tag = document.createElement("style");
	tag.dataset.plugin = "@fky/dsh-threads";
	tag.dataset.pluginCss = STYLE_ID;
	tag.textContent = css;
	document.head.appendChild(tag);
	return () => {
		tag.remove();
	};
}
// src/client/index.tsx
/** Sidebar entry id and `main` panel key. */
const PANEL_ID = "dsh-threads-projects";
/** Right-sidebar tab implementation id: the package name. */
const TAB_ID = "@fky/dsh-threads";
const inject = [
	"slots",
	"locale",
	"layout",
	"uiWorkspace",
	"workspaces",
	"sidebarRightTabs"
];
function PanelIcon({ size }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectsIcon, { size });
}
function ThreadsTab({ t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dsht-tab",
		children: t("tab.description")
	});
}
function apply(root) {
	const ctx = root;
	ctx.effect(() => injectStyles(), "dsh-threads: styles");
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "dsh-threads: locale");
	const t = ctx.locale.bind(NS);
	const openSession = (sessionId) => ctx.uiWorkspace.openSession(sessionId);
	const pinSession = (sessionId, pinned) => pinned ? ctx.workspaces.pinSession(sessionId) : ctx.workspaces.unpinSession(sessionId);
	const showProjects = () => ctx.layout.selectPanel(PANEL_ID);
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: PANEL_ID,
		locale: NS,
		inject: () => ({
			openSession,
			pinSession
		})
	}, ProjectsPage));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: PANEL_ID,
		order: 20,
		locale: NS,
		label: () => t("panel")
	}, PanelIcon));
	ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
		name: "sidebar.workspaces.session.menu.item",
		id: "dsh-threads-make-project",
		order: 150,
		locale: NS,
		inject: () => ({ showProjects })
	}, MakeProjectMenuItem));
	ctx.effect(() => ctx.sidebarRightTabs.register({
		id: TAB_ID,
		kind: "dsh-threads",
		title: () => t("tab.title"),
		guide: [{
			id: "open",
			order: 70,
			title: () => t("tab.title"),
			description: () => t("tab.description")
		}]
	}), "dsh-threads: sidebar tab");
	ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab",
		key: TAB_ID,
		locale: NS
	}, ThreadsTab));
}
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});