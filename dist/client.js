window.__ModuleLoader__.load({
	id: "@fky/dsh-threads",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react_jsx_runtime = require("react/jsx-runtime");
let react = require("react");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
// src/client/chat.ts
const NOTICE_NODE = "dsh-threads-notice";
const OPENED_KEY = "dsh-threads-opened";
const isAppend = (event) => event.surfaceOp === "append";
function isCard(value) {
	const card = value;
	return typeof card === "object" && card !== null && typeof card.threadId === "string" && typeof card.n === "number" && typeof card.title === "string";
}
const noticeDefinition = {
	kind: NOTICE_NODE,
	target: "chat",
	match: (event) => {
		if (event.type !== "user/message" || !isAppend(event) || event.data.source?.kind !== "dsh-threads") return null;
		return {
			id: String(event.data.id),
			role: "start",
			exclusive: true
		};
	},
	start: (_context, match) => {
		const { event } = match;
		const source = event.data.source ?? {};
		const content = Array.isArray(event.data.content) ? event.data.content : [];
		return {
			seq: event.seq,
			time: event.time,
			role: source.role === "brief" || source.role === "reply" || source.role === "report" ? source.role : null,
			wake: typeof source.wake === "boolean" ? source.wake : null,
			threads: Array.isArray(source.threads) ? source.threads.filter(isCard) : [],
			summary: typeof source.summary === "string" ? source.summary : "",
			text: content.find((block) => block.type === "text")?.text ?? ""
		};
	},
	update: (context) => context.state,
	buildViewNode: (context) => {
		if (context.state === void 0) return null;
		const { seq, ...data } = context.state;
		return {
			key: context.key,
			kind: NOTICE_NODE,
			id: context.id,
			target: "chat",
			anchorSeq: seq,
			location: context.start?.location ?? context.matches?.[0]?.location ?? { kind: "unresolved" },
			visibility: "visible",
			groupTree: data.wake === true ? "input" : "turn",
			data
		};
	}
};
const openedDefinition = {
	kind: OPENED_KEY,
	match: (event) => {
		if (event.type === "turn/start") return {
			id: String(event.data.turn),
			role: "start"
		};
		if (event.type === "tool/call" || event.type === "tool/result" && isAppend(event)) return {
			id: String(event.data.turn),
			role: "update"
		};
		return null;
	},
	start: (_context, match) => {
		if (match.event.type !== "turn/start") throw new Error("dsh-threads-opened start requires turn/start");
		return {
			turn: match.event.data.turn,
			calls: /* @__PURE__ */ new Set(),
			opened: []
		};
	},
	update: (context, match) => {
		const state = context.state;
		if (state === void 0) return state;
		const { event } = match;
		if (event.type === "tool/call") {
			if (event.data.name !== "thread_open") return state;
			return {
				...state,
				calls: /* @__PURE__ */ new Set([...state.calls, String(event.data.callId)])
			};
		}
		if (event.type !== "tool/result") return state;
		if (!state.calls.has(String(event.data.message?.source?.callId))) return state;
		const meta = event.data.meta;
		if (!isCard(meta) || state.opened.some((card) => card.threadId === meta.threadId)) return state;
		return {
			...state,
			opened: [...state.opened, {
				threadId: meta.threadId,
				n: meta.n,
				title: meta.title
			}]
		};
	},
	buildLocationData: (context, scope, previous) => {
		const state = context.state;
		if (scope !== "turn" || state === void 0 || state.opened.length === 0) return null;
		if (previous?.kind === "turn" && previous.turn === state.turn && previous.key === "dsh-threads-opened" && previous.value?.opened === state.opened) return previous;
		return {
			kind: "turn",
			turn: state.turn,
			key: OPENED_KEY,
			value: { opened: state.opened }
		};
	}
};
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
function ThreadsIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
		...props,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "6",
				cy: "6",
				r: "2.2"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "18",
				cy: "12",
				r: "2.2"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "6",
				cy: "18",
				r: "2.2"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8.2 6h2.8a4 4 0 0 1 4 4v0M8.2 18h2.8a4 4 0 0 0 4-4v0" })
		]
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
const listeners$2 = /* @__PURE__ */ new Set();
let inflight = null;
function publish$1(next) {
	state = next;
	for (const listener of listeners$2) listener();
}
const projectsStore = {
	getSnapshot: () => state,
	subscribe(listener) {
		listeners$2.add(listener);
		return () => {
			listeners$2.delete(listener);
		};
	},
	/** Reload from the host; concurrent calls share one request. */
	refresh() {
		if (inflight !== null) return inflight;
		if (state.status === "idle") publish$1({
			...state,
			status: "loading"
		});
		inflight = callHost("projects.list").then((projects) => publish$1({
			status: "ready",
			projects,
			error: null
		})).catch((error) => publish$1({
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
// src/client/threads.ts
/** Bumped after any change this browser makes (resolve, reopen), so panes reload. */
let revision = 0;
const listeners$1 = /* @__PURE__ */ new Set();
const threadsRevision = {
	bump() {
		revision += 1;
		for (const listener of listeners$1) listener();
	},
	subscribe(listener) {
		listeners$1.add(listener);
		return () => {
			listeners$1.delete(listener);
		};
	},
	get: () => revision
};
function useThreadsRevision() {
	return (0, react.useSyncExternalStore)(threadsRevision.subscribe, threadsRevision.get);
}
/** Load a host value, reloading whenever `deps` change; keeps the last value while reloading. */
function useHostValue(method, payload, deps) {
	const [value, setValue] = (0, react.useState)(void 0);
	(0, react.useEffect)(() => {
		if (method === null) {
			setValue(void 0);
			return;
		}
		let live = true;
		callHost(method, payload).then((next) => {
			if (live) setValue(next);
		}, () => {});
		return () => {
			live = false;
		};
	}, [method, ...deps]);
	return value;
}
/** Right-sidebar resource address of a thread's conversation. */
const THREAD_ADDRESS = "dsh-resource://dsh-threads/session/";
function threadAddress(threadId) {
	return `${THREAD_ADDRESS}${encodeURIComponent(threadId)}`;
}
function parseThreadAddress(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		return;
	}
	if (url.protocol !== "dsh-resource:" || url.hostname.toLowerCase() !== "dsh-threads") return void 0;
	const parts = url.pathname.split("/").filter(Boolean);
	if (parts.length !== 2 || parts[0] !== "session" || parts[1] === void 0) return void 0;
	try {
		return decodeURIComponent(parts[1]);
	} catch {
		return;
	}
}
const THREAD_ADDRESS_PATTERN = `${THREAD_ADDRESS}**`;
/** StateDot state for a thread row. */
function dotState(thread, running) {
	if (running || thread.status === "running" || thread.status === "starting") return "ongoing";
	if (thread.status === "failed") return "error";
	if (thread.resolved) return "done";
	const report = thread.lastReport?.status;
	if (report === "needs_decision" || report === "blocked") return "warning";
	if (report === "failed") return "error";
	return report === "done" ? "done" : "idle";
}
// src/client/kinds.ts
let kinds = {
	threads: /* @__PURE__ */ new Set(),
	mains: /* @__PURE__ */ new Set()
};
const listeners = /* @__PURE__ */ new Set();
function publish(next) {
	kinds = next;
	for (const listener of listeners) listener();
}
/** Reload on start, after this browser changes something, and when any session starts or stops. */
function syncKinds(status) {
	let disposed = false;
	let pending;
	const load = async () => {
		const next = await callHost("sessions.kinds").catch(() => void 0);
		if (!disposed && next !== void 0) publish({
			threads: new Set(next.threads),
			mains: new Set(next.mains)
		});
	};
	const schedule = () => {
		if (pending !== void 0) clearTimeout(pending);
		pending = setTimeout(() => {
			load();
		}, 300);
	};
	let runningKey = "";
	const offStatus = status?.subscribe(() => {
		const next = [...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(",");
		if (next !== runningKey) {
			runningKey = next;
			schedule();
		}
	});
	const offRevision = threadsRevision.subscribe(schedule);
	load();
	return () => {
		disposed = true;
		if (pending !== void 0) clearTimeout(pending);
		offStatus?.();
		offRevision();
	};
}
function useKinds() {
	return (0, react.useSyncExternalStore)((listener) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, () => kinds);
}
/** sidebar.session.row.leading entry: a small mark on threads and project main conversations. */
function SessionBadge({ sessionId, t }) {
	const { threads, mains } = useKinds();
	if (threads.has(sessionId)) return (0, react.createElement)("span", {
		className: "dsht-badge",
		title: t("badge.thread")
	}, (0, react.createElement)(ThreadsIcon, { size: 13 }));
	if (mains.has(sessionId)) return (0, react.createElement)("span", {
		className: "dsht-badge",
		title: t("badge.project")
	}, (0, react.createElement)(ProjectsIcon, { size: 13 }));
	return null;
}
// src/client/ProposalsDock.tsx
function ProposalsDock({ sessionId, useSessionStatus, t }) {
	const revision = useThreadsRevision();
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(","));
	const proposals = useHostValue(sessionId === void 0 ? null : "proposals.list", { mainSessionId: sessionId }, [
		sessionId,
		runningKey,
		revision
	]);
	const [unchecked, setUnchecked] = (0, react.useState)(/* @__PURE__ */ new Set());
	const [busy, setBusy] = (0, react.useState)(false);
	if (sessionId === void 0 || proposals === void 0 || proposals.length === 0) return null;
	const pending = proposals.filter((p) => p.state === "pending");
	const queued = proposals.filter((p) => p.state === "queued");
	const chosen = pending.filter((p) => !unchecked.has(p.id)).map((p) => p.id);
	const act = async (method, ids) => {
		setBusy(true);
		try {
			await callHost(method, {
				mainSessionId: sessionId,
				ids
			});
			threadsRevision.bump();
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-proposals",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-chat-card-head",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }), t("proposals.title")]
			}),
			pending.map((proposal) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-proposal",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
					checked: !unchecked.has(proposal.id),
					label: proposal.title,
					onChange: (next) => {
						const set = new Set(unchecked);
						if (next) set.delete(proposal.id);
						else set.add(proposal.id);
						setUnchecked(set);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-row-summary",
					children: proposal.task
				})]
			}, proposal.id)),
			queued.map((proposal) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-proposal dsht-proposal-queued",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-row-title",
					children: proposal.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-row-meta",
					children: t("proposals.queued")
				})]
			}, proposal.id)),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-buttons",
				children: [pending.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					size: "sm",
					disabled: busy,
					onClick: () => {
						act("proposals.dismiss", pending.map((p) => p.id));
					},
					children: t("proposals.dismiss")
				}) : null, pending.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					size: "sm",
					disabled: busy || chosen.length === 0,
					onClick: () => {
						act("proposals.start", chosen);
					},
					children: t("proposals.start", { count: chosen.length })
				}) : null]
			})
		]
	});
}
// src/client/ThreadCards.tsx
const STATUS_KEYS = {
	done: "status.done",
	blocked: "status.blocked",
	needs_decision: "status.needsDecision",
	failed: "status.failed",
	"no-report": "status.noReport"
};
function reportDot(status) {
	if (status === "done") return "done";
	if (status === "blocked" || status === "needs_decision") return "warning";
	if (status === "failed") return "error";
	return "idle";
}
function ThreadRow({ card, dot, label, summary, t, openThread }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-card-row",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
				state: dot,
				className: "dsht-dot"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-row-body",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsht-row-title",
					children: [
						"#",
						card.n,
						" ",
						card.title,
						label === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsht-row-status",
							children: [" · ", label]
						})
					]
				}), summary === void 0 || summary.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-row-summary",
					children: summary
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "outline",
				onClick: () => openThread(card.threadId),
				children: t("card.open")
			})
		]
	});
}
/** conversation.chat.node renderer for NOTICE_NODE. */
function NoticeCard({ node, t, openThread }) {
	const { role, threads, summary, text } = node.data;
	const [expanded, setExpanded] = (0, react.useState)(false);
	if (role === "report" && threads.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-chat-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-chat-card-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }), t("notice.report", { count: threads.length })]
		}), threads.map((card) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadRow, {
			card,
			dot: reportDot(card.status),
			label: card.status === void 0 ? void 0 : t(STATUS_KEYS[card.status] ?? "status.noReport"),
			summary: card.summary,
			t,
			openThread
		}, card.threadId))]
	});
	const card = threads[0];
	const heading = role === "brief" ? t("notice.brief") : role === "reply" ? t("notice.reply") : summary;
	const body = text.split("\n").filter((line, index) => !(index === 0 && line.startsWith("["))).join("\n").trim();
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-chat-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-chat-card-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [heading, card === void 0 ? "" : ` · #${card.n} ${card.title}`] })]
		}), body.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: `dsht-chat-card-text ${expanded ? "" : "dsht-clamped"}`,
			onClick: () => setExpanded(!expanded),
			children: body
		})]
	});
}
/** conversation.chat.turnTail entry: the threads this turn opened ("N 条回复"). */
function TurnThreadsCard({ turn, sessionId, useSessionStatus, t, openThread }) {
	const opened = turn.data.get("dsh-threads-opened")?.opened ?? [];
	const revision = useThreadsRevision();
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(","));
	const running = (0, react.useMemo)(() => new Set(runningKey.split(",")), [runningKey]);
	const threads = useHostValue(opened.length === 0 ? null : "threads.list", { mainSessionId: sessionId }, [
		sessionId,
		runningKey,
		revision
	]);
	if (opened.length === 0) return null;
	const byId = new Map((threads ?? []).map((thread) => [thread.id, thread]));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-chat-card dsht-turn-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-chat-card-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }), t("card.replies", { count: opened.length })]
		}), opened.map((card) => {
			const thread = byId.get(card.threadId);
			const isRunning = running.has(card.threadId) || thread?.status === "running" || thread?.status === "starting";
			const dot = isRunning ? "ongoing" : reportDot(thread?.lastReport?.status);
			const label = isRunning ? t("status.running") : thread?.resolved ? t("list.resolved") : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadRow, {
				card,
				dot,
				label,
				summary: isRunning ? void 0 : thread?.lastReport?.summary,
				t,
				openThread
			}, card.threadId);
		})]
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
	"tab.description": "主对话开出的讨论串",
	"tab.thread": "讨论串",
	"pane.resolve": "标记已解决",
	"pane.reopen": "重新打开",
	"pane.openMain": "在主区域打开",
	"list.empty": "这个项目还没有讨论串。",
	"list.notProject": "当前对话不是项目，没有讨论串。可以在左侧会话的\"…\"菜单里选\"设为项目\"。",
	"list.noReport": "还没有回报",
	"list.resolved": "已解决",
	"header.threads": "讨论串 · {count}",
	"header.running": "{count} 个运行中",
	"header.backToMain": "回到主对话",
	"resolved.notice": "此讨论串已解决。重新打开后才能继续发消息。",
	"resolved.reopen": "重新打开",
	"card.open": "查看讨论串",
	"card.replies": "{count} 条回复",
	"notice.report": "讨论串回报（{count}）",
	"notice.brief": "来自主对话的任务",
	"notice.reply": "主对话追加的指令",
	"status.done": "已完成",
	"status.blocked": "受阻",
	"status.needsDecision": "待你决定",
	"status.failed": "失败",
	"status.noReport": "没有回报",
	"status.running": "运行中",
	"proposals.title": "建议开的讨论串",
	"proposals.start": "开始 {count} 个讨论串",
	"proposals.dismiss": "都不要",
	"proposals.queued": "排队中：有讨论串结束后自动开始",
	"badge.thread": "讨论串",
	"badge.project": "项目主对话"
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
	"tab.description": "Threads opened by the main conversation",
	"tab.thread": "Thread",
	"pane.resolve": "Mark resolved",
	"pane.reopen": "Reopen",
	"pane.openMain": "Open in main view",
	"list.empty": "This project has no threads yet.",
	"list.notProject": "This conversation is not a project, so it has no threads. Choose \"Make project\" in its \"…\" menu.",
	"list.noReport": "No report yet",
	"list.resolved": "resolved",
	"header.threads": "Threads · {count}",
	"header.running": "{count} running",
	"header.backToMain": "Back to main conversation",
	"resolved.notice": "This thread is resolved. Reopen it to send more messages.",
	"resolved.reopen": "Reopen",
	"card.open": "Open thread",
	"card.replies": "{count} replies",
	"notice.report": "Thread reports ({count})",
	"notice.brief": "Task from the main conversation",
	"notice.reply": "Follow-up from the main conversation",
	"status.done": "done",
	"status.blocked": "blocked",
	"status.needsDecision": "needs your decision",
	"status.failed": "failed",
	"status.noReport": "no report",
	"status.running": "running",
	"proposals.title": "Suggested threads",
	"proposals.start": "Start {count} threads",
	"proposals.dismiss": "Dismiss all",
	"proposals.queued": "Queued: starts when a running thread finishes",
	"badge.thread": "Thread",
	"badge.project": "Project main conversation"
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
			}).then(() => {
				threadsRevision.bump();
				return projectsStore.refresh();
			}).then(showProjects);
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
		threadsRevision.bump();
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
					threadsRevision.bump();
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
// src/client/resolved.ts
const RESOLVED_KIND = "dsh-threads-resolved";
/**
* Keep one published interaction per resolved thread, re-reading the host list on start,
* after this browser resolves or reopens a thread, and whenever a session starts or stops.
*/
function syncResolved(publish, status) {
	const active = /* @__PURE__ */ new Map();
	let disposed = false;
	let pending;
	const sync = async () => {
		const ids = new Set(await callHost("threads.resolved").catch(() => [...active.keys()]));
		if (disposed) return;
		for (const [id, unpublish] of active) if (!ids.has(id)) {
			unpublish();
			active.delete(id);
		}
		for (const id of ids) if (!active.has(id)) active.set(id, publish({
			key: `${RESOLVED_KIND}:${id}`,
			sessionId: id,
			kind: RESOLVED_KIND
		}, () => {}));
	};
	const schedule = () => {
		if (pending !== void 0) clearTimeout(pending);
		pending = setTimeout(() => {
			sync();
		}, 150);
	};
	let runningKey = "";
	const offStatus = status?.subscribe(() => {
		const next = [...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(",");
		if (next !== runningKey) {
			runningKey = next;
			schedule();
		}
	});
	const offRevision = threadsRevision.subscribe(schedule);
	sync();
	return () => {
		disposed = true;
		if (pending !== void 0) clearTimeout(pending);
		offStatus?.();
		offRevision();
		for (const unpublish of active.values()) unpublish();
		active.clear();
	};
}
async function setThreadResolved(threadId, resolved) {
	await callHost(resolved ? "threads.resolve" : "threads.reopen", { id: threadId });
	threadsRevision.bump();
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
.dsht-chat-card{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;margin:6px 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);font-size:13px}
.dsht-chat-card-head{display:flex;align-items:center;gap:6px;padding:2px 2px 4px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsht-card-row{display:flex;align-items:flex-start;gap:10px;padding:6px 2px}
.dsht-card-row .dsht-row-body{padding-top:1px}
.dsht-row-status{font-weight:400;color:var(--dsw-alias-label-tertiary)}
.dsht-chat-card-text{display:block;width:100%;padding:2px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:19px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer}
.dsht-clamped{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dsht-turn-card{margin-top:8px}
.dsht-proposals{box-sizing:border-box;display:flex;flex-direction:column;gap:6px;margin:0 0 8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);font-size:13px}
.dsht-proposal{display:flex;flex-direction:column;gap:2px;padding:2px 0}
.dsht-proposal .dsht-row-summary{padding-left:24px}
.dsht-proposal-queued{flex-direction:row;justify-content:space-between;gap:8px}
.dsht-badge{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary)}
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
// src/client/ThreadChatTab.tsx
/** Session-scoped child slot this tab declares; only the declaring entry may render it. */
const THREAD_CONVERSATION_SLOT = "dsh-threads.chat.conversation";
function ThreadChatTab({ useTabInfo, useResource, SessionProvider, renderSlot, useSessionStatus, t, openSession }) {
	const { tab } = useTabInfo();
	const threadId = parseThreadAddress(tab.contentId);
	const resource = useResource(tab.contentId);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-chat",
		"data-dsh-threads-chat": "",
		children: [threadId === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadPaneHeader, {
			threadId,
			useSessionStatus,
			t,
			openSession
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dsht-chat-body",
			children: resource.value === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionProvider, {
				session: resource.value.reference,
				children: renderSlot(THREAD_CONVERSATION_SLOT, {})
			})
		})]
	});
}
function ThreadPaneHeader({ threadId, useSessionStatus, t, openSession }) {
	const running = useSessionStatus((statuses) => statuses.get(threadId)?.running === true);
	const revision = useThreadsRevision();
	const thread = useHostValue("threads.get", { id: threadId }, [
		threadId,
		running,
		revision
	]);
	const [busy, setBusy] = (0, react.useState)(false);
	if (thread === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsht-pane-head" });
	const toggle = async () => {
		setBusy(true);
		try {
			await setThreadResolved(threadId, !thread.resolved);
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-pane-head",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(thread, running) }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-pane-title",
				title: thread.title,
				children: [
					"#",
					thread.n,
					" ",
					thread.title,
					thread.projectTitle === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-pane-project",
						children: thread.projectTitle
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				disabled: busy || running,
				onClick: () => {
					toggle();
				},
				children: thread.resolved ? t("pane.reopen") : t("pane.resolve")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => openSession(threadId),
				children: t("pane.openMain")
			})
		]
	});
}
/** The embedded Conversation for the thread the tab's SessionProvider supplies. */
function ThreadConversation({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
	const session = useSession((value) => value);
	const active = useConversation((value) => value.activeTargets.size > 0) || !session.blank && !session.awaitingFirstTurn || session.running;
	const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
	return renderFactorySlot("conversation.content", {
		variant: "embedded",
		phase: !active && session.openState === "loading" && summaryBlank !== true ? "settling" : "active",
		hero: false
	}, { slots: { views: FixedChatConversationView } });
}
function FixedChatConversationView(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: props.renderSlot("conversation.session", { view: "chat" }) });
}
/** Replaces the composer of a resolved thread (conversation.composer chain). */
function ResolvedComposer({ sessionId, t }) {
	const [busy, setBusy] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-resolved",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("resolved.notice") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "outline",
			disabled: busy,
			onClick: () => {
				setBusy(true);
				setThreadResolved(sessionId, false).finally(() => setBusy(false));
			},
			children: t("resolved.reopen")
		})]
	});
}
// src/client/ThreadsList.tsx
const runningIds = (statuses) => [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(",");
/** The project main conversation a session belongs to (itself, or the main of its thread). */
function useProjectMain(sessionId, revision) {
	const role = useHostValue(sessionId === void 0 ? null : "sessions.role", { id: sessionId }, [sessionId, revision]);
	return {
		role,
		mainSessionId: role?.project?.mainSessionId
	};
}
function useThreads(mainSessionId, useSessionStatus, revision) {
	const running = useSessionStatus(runningIds);
	return useHostValue(mainSessionId === void 0 ? null : "threads.list", { mainSessionId }, [
		mainSessionId,
		running,
		revision
	]);
}
function ThreadsListTab({ sessionId, useSessionStatus, t, openThread, openSession }) {
	const revision = useThreadsRevision();
	const { role, mainSessionId } = useProjectMain(sessionId, revision);
	const threads = useThreads(mainSessionId, useSessionStatus, revision);
	const runningKey = useSessionStatus(runningIds);
	const running = (0, react.useMemo)(() => new Set(runningKey.split(",")), [runningKey]);
	if (role === void 0) return null;
	if (role.project === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dsht-tab",
		children: t("list.notProject")
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-list",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-list-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: role.project.title }), role.thread ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				size: "sm",
				variant: "ghost",
				onClick: () => openSession(role.project.mainSessionId),
				children: t("header.backToMain")
			}) : null]
		}), threads === void 0 ? null : threads.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dsht-tab",
			children: t("list.empty")
		}) : threads.map((thread) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "dsht-row",
			onClick: () => openThread(thread.id),
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
				state: dotState(thread, running.has(thread.id)),
				className: "dsht-dot"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsht-row-body",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsht-row-title",
						children: [
							"#",
							thread.n,
							" ",
							thread.title
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-row-summary",
						children: thread.lastReport?.summary ?? thread.error ?? t("list.noReport")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsht-row-meta",
						children: [relativeTime(t, thread.updatedAt), thread.resolved ? ` · ${t("list.resolved")}` : ""]
					})
				]
			})]
		}, thread.id))]
	});
}
/** Conversation header: "讨论串 · N" in a project main conversation, "主对话" in a thread. */
function ThreadsHeaderAction({ sessionId, useSessionStatus, t, openThreadsList, openSession }) {
	const revision = useThreadsRevision();
	const { role, mainSessionId } = useProjectMain(sessionId, revision);
	const isMain = mainSessionId !== void 0 && mainSessionId === sessionId;
	const threads = useThreads(isMain ? mainSessionId : void 0, useSessionStatus, revision);
	if (role === void 0 || role.project === null) return null;
	if (role.thread) {
		const main = role.project.mainSessionId;
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			size: "sm",
			variant: "ghost",
			onClick: () => openSession(main),
			children: t("header.backToMain")
		});
	}
	if (!isMain) return null;
	const count = threads?.length ?? 0;
	const active = threads?.filter((thread) => thread.status === "running" || thread.status === "starting").length ?? 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
		size: "sm",
		variant: "ghost",
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }),
		onClick: openThreadsList,
		children: [t("header.threads", { count }), active > 0 ? ` · ${t("header.running", { count: active })}` : ""]
	});
}
// src/client/index.tsx
/** Sidebar entry id and `main` panel key. */
const PANEL_ID = "dsh-threads-projects";
/** Right-sidebar tab types: the thread list (kind `dsh-threads`) and one thread's conversation. */
const LIST_TAB_ID = "@fky/dsh-threads";
const LIST_TAB_KIND = "dsh-threads";
const CHAT_TAB_ID = "@fky/dsh-threads/chat";
const CHAT_TAB_KIND = "dsh-threads.chat";
const inject = [
	"slots",
	"locale",
	"layout",
	"uiWorkspace",
	"workspaces",
	"sessions",
	"resources",
	"sidebarRight",
	"sidebarRightTabs",
	"uiSession",
	"uiConversation"
];
function PanelIcon({ size }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectsIcon, { size });
}
function waitForAbort(signal) {
	if (signal.aborted) return Promise.resolve();
	return new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
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
	const openThread = (threadId) => ctx.sidebarRight.openResource(threadAddress(threadId), { kind: CHAT_TAB_KIND });
	const openThreadsList = () => ctx.sidebarRight.openTab(LIST_TAB_KIND);
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
	ctx.effect(() => ctx.resources.register({
		protocol: "dsh-threads",
		async *open(address, { signal }) {
			const threadId = parseThreadAddress(address);
			if (threadId === void 0) throw new Error(`dsh-threads: invalid thread address "${address}"`);
			if (signal.aborted) return;
			const reference = ctx.sessions.retain(threadId, {
				source: "dshThreads",
				signal
			});
			try {
				yield {
					ok: true,
					value: {
						threadId,
						reference
					}
				};
				await waitForAbort(signal);
			} finally {
				reference.release();
			}
		}
	}), "dsh-threads: thread resources");
	ctx.effect(() => ctx.sidebarRightTabs.register({
		id: CHAT_TAB_ID,
		kind: CHAT_TAB_KIND,
		patterns: [THREAD_ADDRESS_PATTERN],
		canOpen: (address) => parseThreadAddress(address) !== void 0,
		title: (address) => {
			const id = parseThreadAddress(address);
			return (id === void 0 ? void 0 : ctx.sessions.list.getSnapshot().byId[id]?.displayTitle) ?? t("tab.thread");
		}
	}), "dsh-threads: thread tab type");
	ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab",
		key: CHAT_TAB_ID,
		locale: NS,
		inject: () => ({ openSession }),
		children: { [THREAD_CONVERSATION_SLOT]: {
			kind: "single",
			scope: "session"
		} }
	}, ThreadChatTab));
	ctx.slots.inject(THREAD_CONVERSATION_SLOT, () => ctx.slots.register({ name: THREAD_CONVERSATION_SLOT }, ThreadConversation));
	ctx.effect(() => ctx.sidebarRightTabs.register({
		id: LIST_TAB_ID,
		kind: LIST_TAB_KIND,
		title: () => t("tab.title"),
		guide: [{
			id: "open",
			order: 70,
			title: () => t("tab.title"),
			description: () => t("tab.description")
		}]
	}), "dsh-threads: thread list tab type");
	ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab",
		key: LIST_TAB_ID,
		locale: NS,
		inject: (sessionId) => ({
			sessionId,
			openThread,
			openSession
		})
	}, ThreadsListTab));
	ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
		name: "conversation.session.header.actions",
		id: "dsh-threads",
		order: 15,
		locale: NS,
		inject: () => ({
			openThreadsList,
			openSession
		})
	}, ThreadsHeaderAction));
	ctx.uiConversation.events.register(noticeDefinition);
	ctx.uiConversation.events.register(openedDefinition);
	ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
		name: "conversation.chat.node",
		key: NOTICE_NODE,
		locale: NS,
		inject: () => ({ openThread })
	}, NoticeCard));
	ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
		name: "conversation.chat.turnTail",
		id: OPENED_KEY,
		order: 25,
		locale: NS,
		inject: (sessionId) => ({
			sessionId,
			openThread
		})
	}, TurnThreadsCard));
	ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
		name: "conversation.input.dock",
		id: "dsh-threads-proposals",
		order: 15,
		locale: NS,
		inject: (sessionId) => ({ sessionId })
	}, ProposalsDock));
	ctx.effect(() => syncKinds(ctx.uiSession.sessionStatus), "dsh-threads: session kinds");
	ctx.slots.inject("sidebar.session.row.leading", () => ctx.slots.register({
		name: "sidebar.session.row.leading",
		id: "dsh-threads-kind",
		order: 50,
		locale: NS
	}, SessionBadge));
	const publishResolved = ctx.uiSession.registerPendingInteraction(() => 0);
	ctx.effect(() => syncResolved(publishResolved, ctx.uiSession.sessionStatus), "dsh-threads: resolved threads");
	ctx.slots.inject("conversation.composer", () => ctx.slots.register({
		name: "conversation.composer",
		select: ({ pendingInteraction }) => pendingInteraction?.kind === "dsh-threads-resolved" ? pendingInteraction : null,
		locale: NS
	}, ResolvedComposer));
}
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});