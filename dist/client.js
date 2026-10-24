window.__ModuleLoader__.load({
	id: "@fky/dsh-threads",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_dom = require("react-dom");
// src/client/api.ts
/**
* Host route, relative to the page like DSH's own Connection calls: on Desktop the page is
* dsh-app://app/ and the shell forwards it to the Host with its cookie; on Web it is same-origin.
* Must match RPC_PATH in src/rpc.ts.
*/
const RPC_URL = "api/dsh-threads";
let localeOf = () => void 0;
/** Every host call carries the page's language, so the host's own text follows it (src/messages.ts). */
function sendLocaleToHost(read) {
	localeOf = read;
	return () => {
		localeOf = () => void 0;
	};
}
function pageLocale() {
	try {
		return localeOf();
	} catch {
		return;
	}
}
async function callHost(method, payload = {}) {
	const response = await fetch(RPC_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			method,
			payload,
			locale: pageLocale()
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
// src/client/chat.ts
const NOTICE_NODE = "dsh-threads-notice";
const OPENED_KEY = "dsh-threads-opened";
const isAppend = (event) => event.surfaceOp === "append";
const ROLES = /* @__PURE__ */ new Set([
	"brief",
	"reply",
	"reminder",
	"report"
]);
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
			role: ROLES.has(source.role) ? source.role : null,
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
function Svg$2({ size = 16, children, ...rest }) {
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
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$2, {
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 13h8M8 16h5" })]
	});
}
function FolderIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg$2, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" })
	});
}
function PlusIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg$2, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" })
	});
}
function ThreadsIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$2, {
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
function SearchIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$2, {
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "11",
			cy: "11",
			r: "6.5"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m20 20-4.2-4.2" })]
	});
}
/**
* The icons a project can wear (Claude lets a project pick one). Ids are stored on the project;
* an unknown id falls back to the folder.
*/
const PROJECT_ICON_PATHS = {
	folder: "M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
	scale: "M12 4.5v15M8 19.5h8M5 7.5h14M5 7.5l-2.5 5.5a2.5 2.5 0 0 0 5 0zM19 7.5l-2.5 5.5a2.5 2.5 0 0 0 5 0zM12 4.5v.01",
	code: "m9 7.5-4.5 4.5 4.5 4.5M15 7.5l4.5 4.5-4.5 4.5",
	terminal: "M4 5.5h16v13H4zM7.5 10l2.5 2-2.5 2M12.5 14.5h4",
	rocket: "M12 3c3 2.2 4.8 5.7 4.8 9.6L15 16H9l-1.8-3.4C7.2 8.7 9 5.2 12 3zM12 9.3v.01M9 16l-2.2 4M15 16l2.2 4M12 16v3.5",
	book: "M6.5 4H18v14H7a2 2 0 0 0-2 2V5.5A1.5 1.5 0 0 1 6.5 4zM5 20a2 2 0 0 1 2-2h11v2.5H7a2 2 0 0 1-2-2",
	flask: "M9.5 3.5h5M10.5 3.5v5.7L5.4 18.1a1.6 1.6 0 0 0 1.4 2.4h10.4a1.6 1.6 0 0 0 1.4-2.4l-5.1-8.9V3.5M7.6 14.5h8.8",
	globe: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17",
	palette: "M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2l-.4-1a2 2 0 0 1 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.4-3.8-7.9-8.5-7.9zM7.8 11.5v.01M10 7.6v.01M14.6 7.6v.01",
	star: "m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.6-5.1 2.6 1-5.6-4-3.9 5.6-.8z",
	bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
	chart: "M4 20h16M7 16.5v-5M12 16.5V8M17 16.5V5",
	shield: "M12 3.5 5 6.2v5.6c0 4.1 2.9 7.5 7 8.7 4.1-1.2 7-4.6 7-8.7V6.2z",
	cube: "m12 3.5 8 4.5v8l-8 4.5-8-4.5V8zM4 8l8 4.5L20 8M12 12.5v8",
	layers: "m12 4 8.5 4.5L12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5",
	leaf: "M5 19c0-8.6 5.2-14 14-14 0 8.8-5.4 14-14 14zM5 19l8-8",
	heart: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z",
	music: "M9 17.5v-12l10-2v12M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
	camera: "M4 8.5h3.5L9 6h6l1.5 2.5H20v10H4zM12 10.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
	gamepad: "M7 8h10a4 4 0 0 1 4 4v1.6a2.9 2.9 0 0 1-5.2 1.7L14.6 14H9.4l-1.2 1.3A2.9 2.9 0 0 1 3 13.6V12a4 4 0 0 1 4-4zM7.5 10.3v3M6 11.8h3M15.6 11.2v.01M17.4 12.8v.01",
	briefcase: "M4 8h16v11H4zM9 8V5.5h6V8M4 13h16",
	bulb: "M9.5 18h5M10.5 21h3M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.2v.3h4v-.3c0-.9.5-1.7 1.2-2.2A5.5 5.5 0 0 0 12 3.5z",
	compass: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5z",
	target: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11.5v1"
};
const PROJECT_ICON_IDS = Object.keys(PROJECT_ICON_PATHS);
function ProjectIcon({ id, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg$2, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: PROJECT_ICON_PATHS[id] ?? PROJECT_ICON_PATHS.folder })
	});
}
function BellIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg$2, {
		...props,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" })
	});
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
/** Requests in flight, so the cards of one conversation refreshing together share one call. */
const inFlight = /* @__PURE__ */ new Map();
function sharedCall(method, payload) {
	const key = `${method}\n${JSON.stringify(payload)}`;
	let pending = inFlight.get(key);
	if (pending === void 0) {
		pending = callHost(method, payload).finally(() => inFlight.delete(key));
		inFlight.set(key, pending);
	}
	return pending;
}
function useHostValue(method, payload, deps) {
	const [value, setValue] = (0, react.useState)(void 0);
	(0, react.useEffect)(() => {
		if (method === null) {
			setValue(void 0);
			return;
		}
		let live = true;
		sharedCall(method, payload).then((next) => {
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
// src/client/kinds.ts
const SIDEBAR_STYLE_ID = "@fky/dsh-threads/sidebar";
let kinds = {
	threads: /* @__PURE__ */ new Set(),
	mains: /* @__PURE__ */ new Map(),
	hiddenWorkspaces: /* @__PURE__ */ new Set()
};
const listeners = /* @__PURE__ */ new Set();
const rowSelector = (kind, id) => `[data-row-key="${kind}:${id.replace(/["\\]/g, "\\$&")}"]`;
/** The "Projects" section's rows: active projects, pinned first, then by latest activity. */
function sidebarProjects(projects) {
	return projects.filter((project) => !project.archived).sort((a, b) => a.pinned !== b.pinned ? a.pinned ? -1 : 1 : b.lastActivity.localeCompare(a.lastActivity));
}
/**
* Workspaces to drop from DSH's list: those holding a project session and no other session DSH
* would show. DSH's own rule (`sessionVisible` in dsh-client-ui-workspace) skips unknown, blank
* (unless current), subagent and archived sessions.
*/
function projectOnlyWorkspaces(workspaces, sessions, archived, projectSessions, current) {
	const shown = (id) => {
		const session = sessions[id];
		return session !== void 0 && session.origin !== "subagent" && (session.blank !== true || id === current) && !archived.has(id);
	};
	return workspaces.filter((workspace) => workspace.sessionIds.some((id) => projectSessions.has(id)) && workspace.sessionIds.every((id) => projectSessions.has(id) || !shown(id))).map((workspace) => workspace.workspaceId);
}
/** The generated rule hiding project sessions and project-only workspaces in DSH's list. */
function sidebarCss(next) {
	const hidden = [...[...next.threads, ...next.mains.keys()].map((id) => rowSelector("session", id)), ...[...next.hiddenWorkspaces].flatMap((id) => [rowSelector("workspace", id), rowSelector("overflow", id)])];
	return hidden.length === 0 ? "" : `${hidden.join(",")}{display:none!important}`;
}
function writeSidebarCss(next) {
	if (typeof document === "undefined") return;
	let tag = document.querySelector(`style[data-plugin-css="${SIDEBAR_STYLE_ID}"]`);
	if (tag === null) {
		tag = document.createElement("style");
		tag.dataset.plugin = "@fky/dsh-threads";
		tag.dataset.pluginCss = SIDEBAR_STYLE_ID;
		document.head.appendChild(tag);
	}
	tag.textContent = sidebarCss(next);
}
function publish(next) {
	kinds = next;
	writeSidebarCss(next);
	for (const listener of listeners) listener();
}
/** How long after a session stops the host has surely settled its thread record. */
const SETTLE_MS = 1500;
/**
* Reload on start, after this browser changes something, and when any session starts or stops.
* A thread's record settles on the host just after its session stops, so views that reloaded on
* the stop itself may still see it running; when a session stops, every thread view (they all
* follow `threadsRevision`) reloads once more a moment later.
*/
function syncKinds(status) {
	let disposed = false;
	let pending;
	let settle;
	const load = async () => {
		const next = await callHost("sessions.kinds").catch(() => void 0);
		if (!disposed && next !== void 0) publish({
			...kinds,
			threads: new Set(next.threads),
			mains: new Map(next.mains.map(({ id, ...main }) => [id, main]))
		});
	};
	const schedule = () => {
		if (pending !== void 0) clearTimeout(pending);
		pending = setTimeout(() => {
			load();
		}, 300);
	};
	let running = /* @__PURE__ */ new Set();
	const offStatus = status?.subscribe(() => {
		const next = new Set([...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id));
		const stopped = [...running].some((id) => !next.has(id));
		const changed = stopped || [...next].some((id) => !running.has(id));
		running = next;
		if (!changed) return;
		schedule();
		if (stopped) {
			if (settle !== void 0) clearTimeout(settle);
			settle = setTimeout(() => threadsRevision.bump(), SETTLE_MS);
		}
	});
	const offRevision = threadsRevision.subscribe(schedule);
	load();
	return () => {
		disposed = true;
		if (pending !== void 0) clearTimeout(pending);
		if (settle !== void 0) clearTimeout(settle);
		offStatus?.();
		offRevision();
		document.querySelector(`style[data-plugin-css="${SIDEBAR_STYLE_ID}"]`)?.remove();
	};
}
/** Set by the sidebar's projects section, which reads DSH's workspace and session lists. */
function setHiddenWorkspaces(ids) {
	if (ids.length === kinds.hiddenWorkspaces.size && ids.every((id) => kinds.hiddenWorkspaces.has(id))) return;
	publish({
		...kinds,
		hiddenWorkspaces: new Set(ids)
	});
}
/** Thread counts and states per main conversation, for the sidebar's project rows. */
function useKinds() {
	return (0, react.useSyncExternalStore)((listener) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, () => kinds);
}
// src/client/notify.ts
/** Whether a project at `level` wants to hear that this session finished. */
function wantsNotification(level, kind, waiting) {
	switch (level) {
		case "all": return true;
		case "attention": return kind === "main" || waiting;
		case "waiting": return kind === "thread" && waiting;
		case "none": return false;
	}
}
const STATUS_KEYS$1 = {
	done: "status.done",
	blocked: "status.blocked",
	needs_decision: "status.needsDecision",
	failed: "status.failed",
	"no-report": "status.noReport"
};
function message(target, t) {
	if (target.kind === "main") return {
		title: target.projectTitle,
		body: t("notifyMsg.main", { text: target.text || "…" })
	};
	const title = `${target.projectTitle} · #${target.n} ${target.title}`;
	if (target.waiting) return {
		title,
		body: t("notifyMsg.waiting", { text: target.text || "…" })
	};
	return {
		title,
		body: `${t(STATUS_KEYS$1[target.status ?? "no-report"] ?? "status.noReport")}${target.text.length > 0 ? `：${target.text}` : ""}`
	};
}
const inBackground = () => typeof document === "undefined" || document.visibilityState !== "visible" || !document.hasFocus();
function startNotifications(deps) {
	const { status } = deps;
	if (status === void 0 || typeof Notification === "undefined") return () => {};
	let running = /* @__PURE__ */ new Set();
	let finished = /* @__PURE__ */ new Set();
	let pending;
	let disposed = false;
	const flush = async () => {
		const ids = [...finished];
		finished = /* @__PURE__ */ new Set();
		if (ids.length === 0 || !inBackground()) return;
		const wanted = (await callHost("notifications.describe", { ids }).catch(() => [])).filter((target) => wantsNotification(target.level, target.kind, target.waiting));
		if (disposed || wanted.length === 0) return;
		if (Notification.permission === "default") await Notification.requestPermission().catch(() => "denied");
		if (Notification.permission !== "granted") return;
		for (const target of wanted) {
			const { title, body } = message(target, deps.t);
			const shown = new Notification(title, {
				body,
				tag: `dsh-threads:${target.sessionId}`
			});
			shown.onclick = () => {
				window.focus();
				deps.openSession(target.mainSessionId);
				if (target.kind === "thread") deps.openThread(target.sessionId);
				shown.close();
			};
		}
	};
	const off = status.subscribe(() => {
		const next = new Set([...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id));
		for (const id of running) if (!next.has(id)) finished.add(id);
		running = next;
		if (finished.size === 0) return;
		if (pending !== void 0) clearTimeout(pending);
		pending = setTimeout(() => {
			flush();
		}, 600);
	});
	running = new Set([...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id));
	return () => {
		disposed = true;
		if (pending !== void 0) clearTimeout(pending);
		off();
	};
}
// src/client/glyphs.tsx
/** The one place thread data turns into a state mark. */
function glyphState(thread, running = false) {
	if (running || thread.status === "running" || thread.status === "starting") return "running";
	if (thread.status === "failed") return "failed";
	if (thread.resolved) return "resolved";
	if (thread.archived === true) return "done";
	return reportGlyph(thread.lastReport?.status);
}
/** For card data that carries only the report status (`done`, `needs_decision`, `no-report`, …). */
function reportGlyph(status) {
	if (status === "needs_decision" || status === "blocked") return "waiting";
	if (status === "failed") return "failed";
	return "done";
}
function Svg$1({ children, ...rest }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: 16,
		height: 16,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		...rest,
		children
	});
}
/** Raised hand (path from Lucide, ISC). */
function HandIcon(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$1, {
		...props,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15" })]
	});
}
function ThreadGlyph({ state, label }) {
	const common = {
		className: `dsht-glyph dsht-glyph-${state}`,
		title: label,
		role: label === void 0 ? void 0 : "img",
		"aria-label": label
	};
	switch (state) {
		case "running": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsht-pulse" })
		});
		case "waiting": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HandIcon, {})
		});
		case "failed": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$1, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "8.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 9 6 6M15 9l-6 6" })] })
		});
		case "resolved": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$1, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "8.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m8.5 12.2 2.4 2.4 4.6-4.9" })] })
		});
		case "queued": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg$1, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "8.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 7.5V12l3 2" })] })
		});
		case "done": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			...common,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg$1, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "6.5"
			}) })
		});
	}
}
// src/client/ui.tsx
function Svg({ children, size = 14, ...rest }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		...rest,
		children
	});
}
function ChevronIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9.5 6 6 6-6 6" }) });
}
/** "↳": replies under a message, as in Claude's "↰ 2 条回复". */
function RepliesIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 4.5v7a3 3 0 0 0 3 3h9.5M15 11l3.5 3.5L15 18" }) });
}
function BranchIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "6.5",
			cy: "5.5",
			r: "2"
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "6.5",
			cy: "18.5",
			r: "2"
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
			cx: "17.5",
			cy: "7.5",
			r: "2"
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6.5 7.5v9M17.5 9.5c0 4-5 3.5-9.6 7.4" })
	] });
}
function StartIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 7 4.5 11.5 9 16" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 11.5h10a5 5 0 0 0 5-5V5" })] });
}
function CheckIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m5.5 12.5 4 4 9-9.5" }) });
}
function ReopenIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.5 4.5V9H9" })] });
}
function ExpandIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5 13 11M4.5 19.5 11 13" }) });
}
function StopIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
		x: "6.5",
		y: "6.5",
		width: "11",
		height: "11",
		rx: "2"
	}) });
}
/** Archive box (paths from Lucide, ISC). */
function ArchiveIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
		x: "3",
		y: "4",
		width: "18",
		height: "5",
		rx: "1"
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" })] });
}
function CloseIcon() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 7 10 10M17 7 7 17" }) });
}
const KINDS = {
	md: "doc",
	mdx: "doc",
	txt: "doc",
	rst: "doc",
	doc: "doc",
	docx: "doc",
	pdf: "doc",
	ts: "code",
	tsx: "code",
	js: "code",
	jsx: "code",
	mjs: "code",
	cjs: "code",
	py: "code",
	go: "code",
	rs: "code",
	java: "code",
	kt: "code",
	swift: "code",
	c: "code",
	h: "code",
	cpp: "code",
	cs: "code",
	rb: "code",
	php: "code",
	css: "code",
	scss: "code",
	html: "code",
	vue: "code",
	svelte: "code",
	sh: "code",
	sql: "code",
	json: "data",
	yml: "data",
	yaml: "data",
	toml: "data",
	csv: "data",
	xml: "data",
	lock: "data",
	env: "data"
};
function fileKind(path) {
	const name = path.split(/[\\/]/).pop() ?? path;
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "other" : KINDS[name.slice(dot + 1).toLowerCase()] ?? "other";
}
function FileIcon({ kind }) {
	if (kind === "code") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 8-4 4 4 4M15 8l4 4-4 4" }) });
	if (kind === "data") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 4.5c-2 0-2.5 1-2.5 2.5v2.5c0 1.2-.8 2.5-2 2.5 1.2 0 2 1.3 2 2.5V17c0 1.5.5 2.5 2.5 2.5M15 4.5c2 0 2.5 1 2.5 2.5v2.5c0 1.2.8 2.5 2 2.5-1.2 0-2 1.3-2 2.5V17c0 1.5-.5 2.5-2.5 2.5" }) });
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" }),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3.5V8h4.5" }),
		kind === "doc" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8.5 12.5h7M8.5 15.5h5" }) : null
	] });
}
/** A changed file, with Claude's colored type icon (documents green, code blue, data amber). */
function FileChip({ path }) {
	const kind = fileKind(path);
	const name = path.split(/[\\/]/).pop() ?? path;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: `dsht-chip dsht-file dsht-file-${kind}`,
		title: path,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileIcon, { kind }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dsht-chip-text",
			children: name
		})]
	});
}
function BranchChip({ branch, removed }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: `dsht-chip dsht-branch${removed === true ? " dsht-branch-removed" : ""}`,
		title: branch,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchIcon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dsht-chip-text dsht-mono",
			children: branch
		})]
	});
}
function Pill({ children, onClick, primary, disabled, icon, label }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: `dsht-pill${primary === true ? " dsht-pill-primary" : ""}${children === void 0 ? " dsht-pill-icon" : ""}`,
		disabled,
		"aria-label": label,
		title: label,
		onClick: (event) => {
			event.stopPropagation();
			onClick();
		},
		children: [icon, children]
	});
}
/** Small label above a group of items ("建议的讨论串", "↳ 2 条回复"). */
function CardHead({ icon, children, trailing }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-head-label",
		children: [
			icon,
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children }),
			trailing === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsht-head-trailing",
				children: trailing
			})
		]
	});
}
/**
* One thread, as Claude draws it in a conversation: the whole item opens the thread; a thread
* waiting on the user also shows an explicit "查看讨论串" pill.
*/
function ThreadItem(props) {
	const { n, title, state, status, summary, decision, decisionLabel, files, branch, stateLabel, openLabel, onOpen, compact } = props;
	const waiting = state === "waiting";
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: `dsht-item dsht-item-${state}${compact === true ? " dsht-item-compact" : ""}`,
		role: "button",
		tabIndex: 0,
		onClick: onOpen,
		onKeyDown: (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onOpen();
			}
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, {
				state,
				label: stateLabel
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-item-body",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-item-title",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsht-item-n",
								children: ["#", n]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsht-item-name",
								children: title
							}),
							status === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsht-item-status",
								children: status
							})
						]
					}),
					compact === true || decision === void 0 || decision.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-item-decision",
						children: [decisionLabel === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: decisionLabel }), decision]
					}),
					compact === true || summary === void 0 || summary.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-item-summary",
						children: summary
					}),
					(files?.length ?? 0) === 0 && branch === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-chips",
						children: [branch === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchChip, { branch }), files?.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileChip, { path: file }, file))]
					})
				]
			}),
			waiting ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
				onClick: onOpen,
				children: openLabel
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsht-item-chevron",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronIcon, {})
			})
		]
	});
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
	const [busy, setBusy] = (0, react.useState)(false);
	if (sessionId === void 0 || proposals === void 0 || proposals.length === 0) return null;
	const pending = proposals.filter((p) => p.state === "pending");
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
		className: "dsht-card dsht-proposals",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CardHead, {
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }),
				children: t("proposals.title")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-proposal-list",
				children: proposals.map((proposal) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `dsht-proposal${proposal.state === "queued" ? " dsht-proposal-queued" : ""}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-proposal-body",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-proposal-title",
							children: [proposal.title, proposal.worktree ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsht-tag",
								title: t("proposals.worktree"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchIcon, {}), t("proposals.worktree")]
							}) : null]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsht-proposal-task",
							children: proposal.state === "queued" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, { state: "queued" }), t("proposals.queued")] }) : proposal.task.split("\n", 1)[0]
						})]
					}), proposal.state === "pending" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-proposal-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloseIcon, {}),
							label: t("proposals.dismissOne"),
							disabled: busy,
							onClick: () => {
								act("proposals.dismiss", [proposal.id]);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartIcon, {}),
							label: t("proposals.startOne"),
							disabled: busy,
							onClick: () => {
								act("proposals.start", [proposal.id]);
							}
						})]
					}) : null]
				}, proposal.id))
			}),
			pending.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-card-foot",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					disabled: busy,
					onClick: () => {
						act("proposals.dismiss", pending.map((p) => p.id));
					},
					children: t("proposals.dismiss")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					primary: true,
					disabled: busy,
					onClick: () => {
						act("proposals.start", pending.map((p) => p.id));
					},
					children: t("proposals.start", { count: pending.length })
				})]
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
	"no-report": "status.noReport",
	stopped: "status.stopped"
};
/** Threads that wait on the user lead a report card. */
function waitingFirst(cards) {
	const waiting = (card) => reportGlyph(card.status) === "waiting" ? 0 : 1;
	return [...cards].sort((a, b) => waiting(a) - waiting(b));
}
/** conversation.chat.node renderer for NOTICE_NODE. */
function NoticeCard({ node, sessionId, useSessionStatus, t, openThread }) {
	const { role, threads, summary, text } = node.data;
	const [expanded, setExpanded] = (0, react.useState)(false);
	if (role === "report" && threads.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReportCard, {
		cards: threads,
		sessionId,
		useSessionStatus,
		t,
		openThread
	});
	const card = threads[0];
	const heading = role === "brief" ? t("notice.brief") : role === "reply" ? t("notice.reply") : role === "reminder" ? t("notice.reminder") : summary;
	const body = text.split("\n").filter((line, index) => !(index === 0 && line.startsWith("["))).join("\n").trim();
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-card dsht-brief",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(CardHead, {
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }),
			trailing: card?.branch === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsht-mono",
				children: card.branch
			}),
			children: [heading, card === void 0 ? "" : ` · #${card.n} ${card.title}`]
		}), body.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: `dsht-brief-text${expanded ? "" : " dsht-clamped"}`,
			"aria-expanded": expanded,
			onClick: () => setExpanded(!expanded),
			children: body
		})]
	});
}
/**
* A report as delivered (its summary, files and branch), with each thread's current state, as
* Claude's cards stay live: a thread resolved since then no longer shows a raised hand.
*/
function ReportCard({ cards, sessionId, useSessionStatus, t, openThread }) {
	const revision = useThreadsRevision();
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(","));
	const running = (0, react.useMemo)(() => new Set(runningKey.split(",")), [runningKey]);
	const threads = useHostValue("threads.list", { mainSessionId: sessionId }, [
		sessionId,
		runningKey,
		revision
	]);
	const byId = new Map((threads ?? []).map((thread) => [thread.id, thread]));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-card",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CardHead, {
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }),
			children: t("notice.report", { count: cards.length })
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dsht-items",
			children: waitingFirst(cards).map((card) => {
				const thread = byId.get(card.threadId);
				const state = thread === void 0 ? reportGlyph(card.status) : glyphState(thread, running.has(card.threadId));
				const status = state === "running" ? t("status.running") : state === "resolved" ? t("list.resolved") : t(STATUS_KEYS[thread?.lastReport?.status ?? card.status ?? "no-report"] ?? "status.noReport");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadItem, {
					n: card.n,
					title: card.title,
					state,
					status,
					summary: card.summary,
					decision: state === "waiting" ? card.decision : void 0,
					decisionLabel: t("card.decision"),
					files: card.files,
					branch: card.branch,
					openLabel: t("card.open"),
					onOpen: () => openThread(card.threadId)
				}, card.threadId);
			})
		})]
	});
}
/** conversation.chat.turnTail entry: the threads this turn opened ("↳ N 条回复"), with live state. */
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
		className: "dsht-card dsht-replies",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CardHead, {
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RepliesIcon, {}),
			children: t("card.replies", { count: opened.length })
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dsht-items",
			children: opened.map((card) => {
				const thread = byId.get(card.threadId);
				const state = thread === void 0 ? "running" : glyphState(thread, running.has(card.threadId));
				const report = thread?.lastReport ?? null;
				const status = state === "running" ? t("status.running") : state === "resolved" ? t("list.resolved") : report === null ? void 0 : t(STATUS_KEYS[report.status] ?? "status.noReport");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadItem, {
					compact: true,
					n: card.n,
					title: card.title,
					state,
					status,
					files: state === "running" ? void 0 : report?.changedFiles.slice(0, 2),
					branch: thread?.worktree?.branch ?? card.branch,
					openLabel: t("card.open"),
					onOpen: () => openThread(card.threadId)
				}, card.threadId);
			})
		})]
	});
}
// src/client/locale.ts
/** Locale namespace for every string this plugin shows. */
const NS = "dshThreads";
const zh = {
	"panel": "项目",
	"page.title": "项目",
	"page.new": "新建项目",
	"page.newFrom": "用已有工作区新建",
	"page.search": "搜索项目…",
	"page.sortBy": "排序方式",
	"page.sort.activity": "最近活动",
	"page.sort.created": "创建时间",
	"page.sort.title": "名称",
	"page.empty": "还没有项目。一个项目 = 一个文件夹 + 一个主对话，主对话可以把任务派给讨论串。点\"新建项目\"，或者在左侧会话的\"…\"菜单里选\"设为项目\"。",
	"page.noMatch": "没有匹配的项目。",
	"page.loadFailed": "读取项目失败：{error}",
	"page.archived": "已归档 · {count}",
	"card.threads": "{count} 个讨论串",
	"card.running": "{count} 个运行中",
	"menu.more": "更多操作",
	"menu.pin": "置顶",
	"menu.unpin": "取消置顶",
	"menu.notify": "通知",
	"menu.settings": "设置",
	"menu.archive": "归档",
	"menu.unarchive": "取消归档",
	"menu.delete": "删除",
	"notify.all": "所有新消息",
	"notify.all.hint": "包含每个讨论串的回报",
	"notify.all.short": "全部",
	"notify.attention": "主对话与需要你处理的",
	"notify.attention.hint": "主对话的回复，以及等你决定的讨论串",
	"notify.attention.short": "主对话",
	"notify.waiting": "仅需要你处理的",
	"notify.waiting.hint": "只在讨论串等你决定时",
	"notify.waiting.short": "需处理",
	"notify.none": "无",
	"notify.none.hint": "不发通知",
	"notify.none.short": "关",
	"delete.title": "删除项目「{title}」？",
	"delete.description": "只删除项目记录。主对话和讨论串会保留为普通会话。",
	"delete.confirm": "删除",
	"common.cancel": "取消",
	"common.close": "关闭",
	"new.title": "新建项目",
	"new.name": "名称",
	"new.namePlaceholder": "例如：Vetoarc",
	"new.folder": "文件夹",
	"new.recent": "最近的文件夹",
	"new.chooseFolder": "选择文件夹…",
	"new.change": "更改",
	"new.pathPlaceholder": "/Users/me/code/app",
	"new.pathHint": "写文件夹的完整路径；还不是工作区的话会自动添加。",
	"new.create": "新建项目",
	"new.failed": "创建失败：{error}",
	"new.pickFailed": "没能打开文件夹选择器：{error}",
	"settings.title": "项目设置",
	"settings.general": "通用",
	"settings.memory": "记忆",
	"settings.nameIcon": "名称和图标",
	"settings.chooseIcon": "选择图标",
	"settings.goal": "目标",
	"settings.goalHint": "你希望协调者努力实现的结果。只加进主对话的系统提示。",
	"settings.goalPlaceholder": "例如：把整个 API 的 p95 延迟降到 200 毫秒以内",
	"settings.folder": "文件夹",
	"settings.folderHint": "主对话和讨论串都在这个文件夹里工作。",
	"settings.instructions": "项目说明",
	"settings.instructionsHint": "会加进主对话和所有讨论串的系统提示，例如代码规范、回复语言、要避开的目录。",
	"settings.instructionsPlaceholder": "例如：用中文回复；不要改 vendor/ 下的文件；提交信息用 Conventional Commits。",
	"settings.saveFailed": "保存失败：{error}",
	"settings.usage": "使用情况",
	"settings.models": "模型",
	"settings.mainModel": "协调器模型",
	"settings.mainModelHint": "主对话用的模型，负责管理和开讨论串。",
	"settings.mainEffort": "协调器思考强度",
	"settings.mainEffortHint": "主对话管理和开讨论串时的思考强度。",
	"settings.threadModel": "讨论串模型",
	"settings.threadModelHint": "新讨论串默认用的模型。",
	"settings.threadEffort": "讨论串思考强度",
	"settings.threadEffortHint": "新讨论串默认的思考强度。",
	"settings.default": "默认（{name}）",
	"settings.loadingModels": "读取模型…",
	"usage.hint": "主对话和每个讨论串用掉的 token，来自 DSH 的用量统计（不含费用）。输入包括缓存读写。",
	"usage.loading": "正在统计…",
	"usage.session": "会话",
	"usage.input": "输入",
	"usage.output": "输出",
	"usage.main": "主对话",
	"notifyMsg.main": "主对话回复了：{text}",
	"notifyMsg.waiting": "等你决定：{text}",
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
	"pane.stop": "停止",
	"pane.archive": "归档",
	"pane.unarchive": "取消归档",
	"pane.archived": "已归档",
	"list.empty": "这个项目还没有讨论串。",
	"list.notProject": "当前对话不是项目，没有讨论串。可以在左侧会话的\"…\"菜单里选\"设为项目\"。",
	"list.noReport": "还没有回报",
	"list.resolved": "已解决",
	"list.archived": "已归档 · {count}",
	"header.threads": "讨论串 · {count}",
	"header.running": "{count} 个运行中",
	"header.waiting": "{count} 个等你回复",
	"header.backToMain": "回到主对话",
	"resolved.notice": "此讨论串已解决。",
	"resolved.hint": "请重新打开以发送更多消息。",
	"resolved.reopen": "重新打开",
	"card.open": "查看讨论串",
	"card.replies": "{count} 条回复",
	"card.decision": "等你决定：",
	"notice.report": "讨论串回报 · {count}",
	"notice.brief": "来自主对话的任务",
	"notice.reply": "主对话追加的指令",
	"notice.reminder": "提醒回报",
	"status.done": "已完成",
	"status.blocked": "受阻",
	"status.needsDecision": "待你决定",
	"status.failed": "失败",
	"status.noReport": "没有回报",
	"status.running": "运行中",
	"status.stopped": "已停止",
	"proposals.title": "建议的讨论串",
	"proposals.start": "开始 {count} 个讨论串",
	"proposals.dismiss": "都不要",
	"proposals.queued": "排队中 · 有讨论串结束后自动开始",
	"proposals.startOne": "开始这个讨论串",
	"proposals.dismissOne": "不要这个",
	"proposals.worktree": "独立 worktree",
	"badge.waiting": "{count} 个讨论串在等你回复",
	"badge.running": "{count} 个讨论串运行中",
	"side.title": "项目",
	"side.more": "展开其余 {count} 个",
	"side.less": "收起",
	"side.empty": "新建一个项目",
	"side.mainRunning": "主对话运行中"
};
const en = {
	"panel": "Projects",
	"page.title": "Projects",
	"page.new": "New project",
	"page.newFrom": "New from a workspace",
	"page.search": "Search projects…",
	"page.sortBy": "Sort by",
	"page.sort.activity": "Recent activity",
	"page.sort.created": "Date created",
	"page.sort.title": "Name",
	"page.empty": "No projects yet. A project is one folder and one main conversation that can hand tasks to threads. Choose \"New project\", or \"Make project\" in a conversation's \"…\" menu.",
	"page.noMatch": "No matching projects.",
	"page.loadFailed": "Could not load projects: {error}",
	"page.archived": "Archived · {count}",
	"card.threads": "{count} threads",
	"card.running": "{count} running",
	"menu.more": "More actions",
	"menu.pin": "Pin",
	"menu.unpin": "Unpin",
	"menu.notify": "Notifications",
	"menu.settings": "Settings",
	"menu.archive": "Archive",
	"menu.unarchive": "Unarchive",
	"menu.delete": "Delete",
	"notify.all": "All new messages",
	"notify.all.hint": "Including every thread's report",
	"notify.all.short": "All",
	"notify.attention": "Main conversation and what needs you",
	"notify.attention.hint": "Main conversation replies and threads waiting for you",
	"notify.attention.short": "Main",
	"notify.waiting": "Only what needs you",
	"notify.waiting.hint": "Only when a thread waits for your decision",
	"notify.waiting.short": "Needs you",
	"notify.none": "None",
	"notify.none.hint": "No notifications",
	"notify.none.short": "Off",
	"delete.title": "Delete project \"{title}\"?",
	"delete.description": "Only the project record is deleted. Its main conversation and threads stay as ordinary conversations.",
	"delete.confirm": "Delete",
	"common.cancel": "Cancel",
	"common.close": "Close",
	"new.title": "New project",
	"new.name": "Name",
	"new.namePlaceholder": "e.g. Vetoarc",
	"new.folder": "Folder",
	"new.recent": "Recent folders",
	"new.chooseFolder": "Choose a folder…",
	"new.change": "Change",
	"new.pathPlaceholder": "/Users/me/code/app",
	"new.pathHint": "The folder's full path; it is added as a workspace if it is not one yet.",
	"new.create": "Create project",
	"new.failed": "Could not create the project: {error}",
	"new.pickFailed": "Could not open the folder picker: {error}",
	"settings.title": "Project settings",
	"settings.general": "General",
	"settings.memory": "Memory",
	"settings.nameIcon": "Name and icon",
	"settings.chooseIcon": "Choose an icon",
	"settings.goal": "Goal",
	"settings.goalHint": "The outcome you want the coordinator to work towards. Only the main conversation sees it.",
	"settings.goalPlaceholder": "e.g. Bring the whole API's p95 latency under 200 ms",
	"settings.folder": "Folder",
	"settings.folderHint": "The main conversation and its threads work in this folder.",
	"settings.instructions": "Project instructions",
	"settings.instructionsHint": "Added to the system prompt of the main conversation and every thread: code style, reply language, folders to leave alone.",
	"settings.instructionsPlaceholder": "e.g. Reply in English; do not touch vendor/; use Conventional Commits.",
	"settings.saveFailed": "Could not save: {error}",
	"settings.usage": "Usage",
	"settings.models": "Models",
	"settings.mainModel": "Coordinator model",
	"settings.mainModelHint": "The model of the main conversation, which manages and opens threads.",
	"settings.mainEffort": "Coordinator thinking",
	"settings.mainEffortHint": "How hard the main conversation thinks while managing threads.",
	"settings.threadModel": "Thread model",
	"settings.threadModelHint": "The default model of new threads.",
	"settings.threadEffort": "Thread thinking",
	"settings.threadEffortHint": "The default thinking strength of new threads.",
	"settings.default": "Default ({name})",
	"settings.loadingModels": "Loading models…",
	"usage.hint": "Tokens used by the main conversation and each thread, from DSH's usage counters (no cost). Input includes cache reads and writes.",
	"usage.loading": "Counting…",
	"usage.session": "Conversation",
	"usage.input": "Input",
	"usage.output": "Output",
	"usage.main": "Main conversation",
	"notifyMsg.main": "Main conversation replied: {text}",
	"notifyMsg.waiting": "Waiting for you: {text}",
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
	"pane.stop": "Stop",
	"pane.archive": "Archive",
	"pane.unarchive": "Unarchive",
	"pane.archived": "Archived",
	"list.empty": "This project has no threads yet.",
	"list.notProject": "This conversation is not a project, so it has no threads. Choose \"Make project\" in its \"…\" menu.",
	"list.noReport": "No report yet",
	"list.resolved": "resolved",
	"list.archived": "Archived · {count}",
	"header.threads": "Threads · {count}",
	"header.running": "{count} running",
	"header.waiting": "{count} waiting for you",
	"header.backToMain": "Back to main conversation",
	"resolved.notice": "This thread is resolved. ",
	"resolved.hint": "Reopen it to send more messages.",
	"resolved.reopen": "Reopen",
	"card.open": "Open thread",
	"card.replies": "{count} replies",
	"card.decision": "Waiting for you: ",
	"notice.report": "Thread reports · {count}",
	"notice.brief": "Task from the main conversation",
	"notice.reply": "Follow-up from the main conversation",
	"notice.reminder": "Report reminder",
	"status.done": "done",
	"status.blocked": "blocked",
	"status.needsDecision": "needs your decision",
	"status.failed": "failed",
	"status.noReport": "no report",
	"status.running": "running",
	"status.stopped": "stopped",
	"proposals.title": "Suggested threads",
	"proposals.start": "Start {count} threads",
	"proposals.dismiss": "Dismiss all",
	"proposals.queued": "Queued · starts when a running thread finishes",
	"proposals.startOne": "Start this thread",
	"proposals.dismissOne": "Dismiss",
	"proposals.worktree": "Own worktree",
	"badge.waiting": "{count} thread(s) waiting for you",
	"badge.running": "{count} thread(s) running",
	"side.title": "Projects",
	"side.more": "Show {count} more",
	"side.less": "Show less",
	"side.empty": "Create a project",
	"side.mainRunning": "Main conversation running"
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
const basename = (path) => path.split(/[\\/]/).filter((part) => part.length > 0).pop() ?? path;
function NewProjectDialog({ open, initialFolder, onClose, onCreated, workspaces, pickFolder, t }) {
	const [title, setTitle] = (0, react.useState)("");
	/** The user typed the name; picking a folder no longer overwrites it. */
	const [named, setNamed] = (0, react.useState)(false);
	const [folder, setFolder] = (0, react.useState)(null);
	const [typing, setTyping] = (0, react.useState)(false);
	const [recentOpen, setRecentOpen] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		if (!open) return;
		setFolder(initialFolder ?? null);
		setTitle(initialFolder === null || initialFolder === void 0 ? "" : basename(initialFolder));
		setNamed(false);
		setTyping(false);
		setError(null);
	}, [open, initialFolder]);
	const choose = (path) => {
		setFolder(path);
		if (!named) setTitle(basename(path));
	};
	const pick = async () => {
		setError(null);
		let picked;
		try {
			picked = await pickFolder();
		} catch (failure) {
			setError(t("new.pickFailed", { error: failure instanceof Error ? failure.message : String(failure) }));
			return;
		}
		if (picked === "unavailable") setTyping(true);
		else if (picked !== null) choose(picked);
	};
	const close = () => {
		setRecentOpen(false);
		onClose();
	};
	const ready = title.trim().length > 0 && (folder ?? "").trim().length > 0;
	const submit = async () => {
		if (!ready || busy) return;
		setBusy(true);
		setError(null);
		try {
			const project = await callHost("projects.create", {
				title,
				folder: (folder ?? "").trim()
			});
			await projectsStore.refresh();
			close();
			onCreated(project);
		} catch (failure) {
			setError(t("new.failed", { error: failure instanceof Error ? failure.message : String(failure) }));
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
		open,
		onClose: close,
		title: t("new.title"),
		headless: true,
		className: "dsht-dialog dsht-np",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dsht-np-body",
			onSubmit: (event) => {
				event.preventDefault();
				submit();
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-dialog-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "dsht-dialog-title",
						children: t("new.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsht-icon-button",
						"aria-label": t("common.close"),
						title: t("common.close"),
						onClick: close,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloseIcon, {})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dsht-np-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-np-label",
						children: t("new.name")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "dsht-np-input",
						value: title,
						placeholder: t("new.namePlaceholder"),
						maxLength: 60,
						"data-modal-autofocus": true,
						onChange: (event) => {
							setTitle(event.target.value);
							setNamed(event.target.value.length > 0);
						}
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-np-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-np-label-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsht-np-label",
							children: t("new.folder")
						}), workspaces.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: recentOpen,
							onClose: () => setRecentOpen(false),
							align: "end",
							portal: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "dsht-np-link",
								onClick: () => setRecentOpen(!recentOpen),
								children: [t("new.recent"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 14 })]
							}),
							children: workspaces.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderIcon, { size: 16 }),
								onSelect: () => {
									choose(workspace.path);
									setTyping(false);
									setRecentOpen(false);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsht-menu-two",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: workspace.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsht-menu-sub",
										children: workspace.path
									})]
								})
							}, workspace.workspaceId))
						})]
					}), typing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "dsht-np-input dsht-mono",
						value: folder ?? "",
						placeholder: t("new.pathPlaceholder"),
						spellCheck: false,
						onChange: (event) => setFolder(event.target.value),
						onBlur: () => {
							if (!named && (folder ?? "").trim().length > 0) setTitle(basename(folder ?? ""));
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-hint",
						children: t("new.pathHint")
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `dsht-np-folder${folder === null ? " dsht-np-folder-empty" : ""}`,
						onClick: () => {
							pick();
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderIcon, { size: 18 }),
							folder === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsht-np-folder-text",
								children: t("new.chooseFolder")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsht-np-folder-text",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsht-np-folder-name",
									children: basename(folder)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsht-np-folder-path",
									children: folder
								})]
							}),
							folder === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsht-np-change",
								children: t("new.change")
							})
						]
					})]
				}),
				error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsht-error",
					children: error
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-dialog-actions",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						type: "button",
						onClick: close,
						children: t("common.cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						type: "submit",
						disabled: busy || !ready,
						children: t("new.create")
					})]
				})
			]
		})
	});
}
// src/client/ProjectModels.tsx
const DEFAULT = "default";
const key = (provider, model) => `${provider}\u0000${model}`;
function findModel(catalog, choice) {
	if (catalog === void 0) return void 0;
	const target = choice ?? catalog.default;
	return catalog.groups.find((group) => group.id === target.provider)?.models.find((model) => model.id === target.model);
}
/** A menu dressed as a select box, as DSH's own settings do it (there is no Select primitive). */
function SelectMenu({ value, label, items, onSelect, disabled }) {
	const [open, setOpen] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
		open,
		onClose: () => setOpen(false),
		align: "end",
		portal: true,
		selection: "check",
		selectedId: value,
		items,
		onSelect: (id) => {
			setOpen(false);
			onSelect(id);
		},
		anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "dsht-select-box",
			disabled,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			onClick: () => setOpen(!open),
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsht-select-box-text",
				children: label
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 14 })]
		})
	});
}
function ModelPair({ choice, catalog, modelTitle, modelHint, effortTitle, effortHint, onChange, t }) {
	const defaultModel = findModel(catalog, null);
	const model = findModel(catalog, choice);
	const modelItems = [{
		id: DEFAULT,
		label: t("settings.default", { name: defaultModel?.name ?? catalog?.default.model ?? "…" })
	}, ...(catalog?.groups ?? []).flatMap((group) => [
		{
			type: "separator",
			id: `sep:${group.id}`
		},
		{
			type: "label",
			id: `label:${group.id}`,
			text: group.name
		},
		...group.models.map((item) => ({
			id: key(group.id, item.id),
			label: item.name
		}))
	])];
	const modelValue = choice === null ? DEFAULT : key(choice.provider, choice.model);
	const modelLabel = choice === null ? t("settings.default", { name: defaultModel?.name ?? catalog?.default.model ?? "…" }) : model?.name ?? choice.model;
	const efforts = model?.reasoning?.efforts ?? [];
	const effortDefault = efforts.find((effort) => effort.id === (choice === null ? catalog?.default.reasoningEffort : model?.reasoning?.defaultEffort));
	const effortItems = [{
		id: DEFAULT,
		label: t("settings.default", { name: effortDefault?.name ?? "—" })
	}, ...efforts.map((effort) => ({
		id: effort.id,
		label: effort.name
	}))];
	const effortValue = choice?.reasoningEffort ?? DEFAULT;
	const effortLabel = choice?.reasoningEffort === void 0 ? t("settings.default", { name: effortDefault?.name ?? "—" }) : efforts.find((effort) => effort.id === choice.reasoningEffort)?.name ?? choice.reasoningEffort;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-setting-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-setting-text",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-title",
				children: t(modelTitle)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-hint",
				children: t(modelHint)
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectMenu, {
			value: modelValue,
			label: catalog === void 0 ? t("settings.loadingModels") : modelLabel,
			items: modelItems,
			disabled: catalog === void 0,
			onSelect: (id) => {
				if (id === DEFAULT) return onChange(null);
				const [provider, modelId] = id.split("\0");
				if (provider !== void 0 && modelId !== void 0) onChange({
					provider,
					model: modelId
				});
			}
		})]
	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-setting-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-setting-text",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-title",
				children: t(effortTitle)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-hint",
				children: t(effortHint)
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectMenu, {
			value: effortValue,
			label: effortLabel,
			items: effortItems,
			disabled: catalog === void 0 || choice === null || efforts.length === 0,
			onSelect: (id) => {
				if (choice === null) return;
				const { reasoningEffort: _previous, ...rest } = choice;
				onChange(id === DEFAULT ? rest : {
					...rest,
					reasoningEffort: id
				});
			}
		})]
	})] });
}
/** The four model rows; each change saves at once (the coordinator model applies to the main conversation). */
function ModelSettings({ project, open, save, t }) {
	const catalog = useHostValue(open ? "models.catalog" : null, {}, [open]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-setting-group",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-group-title",
				children: t("settings.models")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPair, {
				choice: project.mainModel,
				catalog,
				t,
				modelTitle: "settings.mainModel",
				modelHint: "settings.mainModelHint",
				effortTitle: "settings.mainEffort",
				effortHint: "settings.mainEffortHint",
				onChange: (next) => {
					save({ mainModel: next });
				}
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPair, {
				choice: project.threadModel,
				catalog,
				t,
				modelTitle: "settings.threadModel",
				modelHint: "settings.threadModelHint",
				effortTitle: "settings.threadEffort",
				effortHint: "settings.threadEffortHint",
				onChange: (next) => {
					save({ threadModel: next });
				}
			})
		]
	});
}
function tokens(value) {
	if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`;
	if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}K`;
	return String(value);
}
/** "使用情况": tokens of the main conversation and every thread, read from DSH's usage projections. */
function UsageSection({ project, t }) {
	const usage = useHostValue("projects.usage", { id: project.id }, [project.id]);
	if (usage === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dsht-setting-hint dsht-usage-loading",
		children: t("usage.loading")
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-setting-block",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-setting-hint",
				children: t("usage.hint")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-usage-total",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-usage-figure",
					children: tokens(usage.total.input)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-setting-hint",
					children: t("usage.input")
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-usage-figure",
					children: tokens(usage.total.output)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-setting-hint",
					children: t("usage.output")
				})] })]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
				className: "dsht-usage-table",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("usage.session") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("usage.input") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("usage.output") })
				] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: usage.rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.kind === "main" ? t("usage.main") : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsht-item-n",
						children: ["#", row.n]
					}), row.title] }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: tokens(row.input) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: tokens(row.output) })
				] }, row.sessionId)) })]
			})
		]
	});
}
// src/client/ProjectSettings.tsx
const GOAL_MAX = 8e3;
const MEMORY_MAX = 4e3;
const SECTIONS = [
	{
		id: "general",
		label: "settings.general",
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineRegular, { size: 16 })
	},
	{
		id: "memory",
		label: "settings.memory",
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
			id: "book",
			size: 16
		})
	},
	{
		id: "usage",
		label: "settings.usage",
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
			id: "chart",
			size: 16
		})
	}
];
function ProjectSettings({ project, open, onClose, t }) {
	const [section, setSection] = (0, react.useState)("general");
	const [title, setTitle] = (0, react.useState)("");
	const [goal, setGoal] = (0, react.useState)("");
	const [memory, setMemory] = (0, react.useState)("");
	const [picking, setPicking] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		if (!open || project === null) return;
		setTitle(project.title);
		setGoal(project.goal);
		setMemory(project.instructions);
		setPicking(false);
		setError(null);
	}, [open, project?.id]);
	if (project === null) return null;
	const save = async (patch) => {
		if (!Object.entries(patch).some(([key, value]) => JSON.stringify(project[key]) !== JSON.stringify(value))) return;
		setError(null);
		try {
			await callHost("projects.update", {
				id: project.id,
				...patch
			});
			await projectsStore.refresh();
		} catch (failure) {
			setError(t("settings.saveFailed", { error: failure instanceof Error ? failure.message : String(failure) }));
		}
	};
	const close = () => {
		save({
			title: title.trim().length > 0 ? title : project.title,
			goal,
			instructions: memory
		});
		onClose();
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
		open,
		onClose: close,
		title: t("settings.title"),
		headless: true,
		className: "dsht-dialog dsht-settings",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-settings-layout",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
				className: "dsht-settings-nav",
				"aria-label": t("settings.title"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsht-settings-nav-title",
					children: t("settings.title")
				}), SECTIONS.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `dsht-settings-nav-item${section === item.id ? " is-active" : ""}`,
					"aria-current": section === item.id ? "page" : void 0,
					onClick: () => setSection(item.id),
					children: [item.icon, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(item.label) })]
				}, item.id))]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-settings-main",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-settings-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "dsht-dialog-title",
						children: t(SECTIONS.find((item) => item.id === section)?.label ?? "settings.general")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsht-icon-button",
						"aria-label": t("common.close"),
						title: t("common.close"),
						onClick: close,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloseIcon, {})
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-settings-body",
					children: [error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-error",
						children: error
					}), section === "general" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-setting-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsht-setting-text",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-title",
									children: t("settings.nameIcon")
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsht-name-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsht-icon-pick",
									"aria-label": t("settings.chooseIcon"),
									title: t("settings.chooseIcon"),
									"aria-expanded": picking,
									onClick: () => setPicking(!picking),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
										id: project.icon,
										size: 18
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dsht-name-input",
									value: title,
									maxLength: 60,
									onChange: (event) => setTitle(event.target.value),
									onBlur: () => {
										if (title.trim().length > 0) save({ title });
									}
								})]
							})]
						}),
						picking ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsht-icon-grid",
							role: "listbox",
							"aria-label": t("settings.chooseIcon"),
							children: PROJECT_ICON_IDS.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "option",
								"aria-selected": project.icon === id,
								className: `dsht-icon-cell${project.icon === id ? " is-active" : ""}`,
								onClick: () => {
									save({ icon: id });
									setPicking(false);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
									id,
									size: 18
								})
							}, id))
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-setting-block",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-title",
									children: t("settings.goal")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-hint",
									children: t("settings.goalHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "dsht-setting-textarea",
									value: goal,
									maxLength: GOAL_MAX,
									placeholder: t("settings.goalPlaceholder"),
									onChange: (event) => setGoal(event.target.value),
									onBlur: () => {
										save({ goal });
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsht-counter",
									children: [
										goal.length.toLocaleString(),
										" / ",
										GOAL_MAX.toLocaleString()
									]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSettings, {
							project,
							open,
							save,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-setting-block",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-title",
									children: t("settings.folder")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-hint",
									children: t("settings.folderHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsht-setting-path dsht-mono",
									title: project.folder,
									children: project.folder
								})
							]
						})
					] }) : section === "usage" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSection, {
						project,
						t
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-setting-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsht-setting-title",
								children: t("settings.instructions")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsht-setting-hint",
								children: t("settings.instructionsHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "dsht-setting-textarea dsht-setting-textarea-tall",
								value: memory,
								maxLength: MEMORY_MAX,
								placeholder: t("settings.instructionsPlaceholder"),
								onChange: (event) => setMemory(event.target.value),
								onBlur: () => {
									save({ instructions: memory });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsht-counter",
								children: [
									memory.length.toLocaleString(),
									" / ",
									MEMORY_MAX.toLocaleString()
								]
							})
						]
					})]
				})]
			})]
		})
	});
}
// src/client/ProjectActions.tsx
const NOTIFY_LEVELS = [
	"all",
	"attention",
	"waiting",
	"none"
];
/** The actions, plus the dialogs they open (render `dialogs` once next to the menus). */
function useProjectActions({ projects, t, pinSession, afterArchive }) {
	const [settingsId, setSettingsId] = (0, react.useState)(null);
	const [deleting, setDeleting] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)(null);
	const run = async (action) => {
		setError(null);
		try {
			await action();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : String(failure));
		} finally {
			threadsRevision.bump();
			await projectsStore.refresh();
		}
	};
	const actions = {
		togglePin: (project) => run(async () => {
			await callHost("projects.pin", {
				id: project.id,
				pinned: !project.pinned
			});
			await pinSession(project.mainSessionId, !project.pinned).catch(() => {});
		}),
		setNotify: (project, notify) => run(() => callHost("projects.update", {
			id: project.id,
			notify
		})),
		openSettings: (project) => setSettingsId(project.id),
		toggleArchive: (project) => run(async () => {
			await callHost(project.archived ? "projects.unarchive" : "projects.archive", { id: project.id });
			if (afterArchive !== void 0) setTimeout(afterArchive, 120);
		}),
		askDelete: (project) => setDeleting(project)
	};
	const remove = (project) => run(async () => {
		setDeleting(null);
		await callHost("projects.remove", { id: project.id });
		if (project.pinned) await pinSession(project.mainSessionId, false).catch(() => {});
	});
	return {
		actions,
		dialogs: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectSettings, {
			project: projects.find((p) => p.id === settingsId) ?? null,
			open: settingsId !== null,
			onClose: () => setSettingsId(null),
			t
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
			open: deleting !== null,
			onClose: () => setDeleting(null),
			title: deleting === null ? "" : t("delete.title", { title: deleting.title }),
			description: t("delete.description"),
			closeLabel: t("common.close"),
			footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-buttons",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					onClick: () => setDeleting(null),
					children: t("common.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: "dsht-danger",
					onClick: () => {
						if (deleting !== null) remove(deleting);
					},
					children: t("delete.confirm")
				})]
			})
		})] }),
		error
	};
}
const SHORTCUTS = {
	p: "pin",
	s: "settings",
	a: "archive",
	d: "delete"
};
/** The "⋮" button and its menu. */
function ProjectMenu({ project, actions, t, onOpenChange }) {
	const [open, setOpenState] = (0, react.useState)(false);
	const setOpen = (next) => {
		setOpenState(next);
		onOpenChange?.(next);
	};
	const act = (id) => {
		setOpen(false);
		if (id === "pin") actions.togglePin(project);
		else if (id === "settings") actions.openSettings(project);
		else if (id === "archive") actions.toggleArchive(project);
		else if (id === "delete") actions.askDelete(project);
		else if (id.startsWith("notify:")) actions.setNotify(project, id.slice(7));
	};
	(0, react.useEffect)(() => {
		if (!open) return;
		const onKey = (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const id = SHORTCUTS[event.key.toLowerCase()];
			if (id === void 0 || id === "pin" && project.archived) return;
			event.preventDefault();
			event.stopPropagation();
			act(id);
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [open, project]);
	const items = [
		...project.archived ? [] : [{
			id: "pin",
			label: project.pinned ? t("menu.unpin") : t("menu.pin"),
			icon: project.pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 16 }),
			shortcut: { keys: ["P"] }
		}],
		{
			id: "notify",
			label: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsht-menu-aside-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("menu.notify") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-menu-aside",
					children: t(`notify.${project.notify}.short`)
				})]
			}),
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BellIcon, { size: 16 }),
			submenu: NOTIFY_LEVELS.map((level) => ({
				id: `notify:${level}`,
				icon: project.notify === level ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsht-menu-icon-space" }),
				label: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsht-menu-two",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(`notify.${level}`) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsht-menu-sub",
						children: t(`notify.${level}.hint`)
					})]
				})
			}))
		},
		{
			id: "settings",
			label: t("menu.settings"),
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineRegular, { size: 16 }),
			shortcut: { keys: ["S"] }
		},
		{
			type: "separator",
			id: "separator"
		},
		{
			id: "archive",
			label: project.archived ? t("menu.unarchive") : t("menu.archive"),
			icon: project.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 16 }),
			shortcut: { keys: ["A"] }
		},
		{
			id: "delete",
			label: t("menu.delete"),
			icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 16 }),
			danger: true,
			shortcut: { keys: ["D"] }
		}
	];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
		open,
		onClose: () => setOpen(false),
		align: "end",
		portal: true,
		items,
		onSelect: act,
		anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: "dsht-icon-button",
			"aria-label": t("menu.more"),
			title: t("menu.more"),
			"aria-haspopup": "menu",
			"aria-expanded": open,
			onClick: () => setOpen(!open),
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, { size: 16 })
		})
	});
}
// src/client/ProjectsPage.tsx
const SORT_LABELS = {
	activity: "page.sort.activity",
	created: "page.sort.created",
	title: "page.sort.title"
};
const sameList = (a, b) => a.length === b.length && a.every((item, index) => item.workspaceId === b[index]?.workspaceId && item.title === b[index]?.title);
function sortProjects(projects, sort) {
	const key = (p) => sort === "created" ? p.createdAt : p.lastActivity;
	return [...projects].sort((a, b) => {
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		if (sort === "title") return a.title.localeCompare(b.title);
		return key(b).localeCompare(key(a));
	});
}
function ProjectsPage({ t, useWorkspaces, useSessionStatus, openSession, pinSession, pickFolder, showProjects }) {
	const { status, projects, error } = useProjects();
	const [query, setQuery] = (0, react.useState)("");
	const [sort, setSort] = (0, react.useState)("activity");
	const [sortOpen, setSortOpen] = (0, react.useState)(false);
	const [newOpen, setNewOpen] = (0, react.useState)(false);
	const [creating, setCreating] = (0, react.useState)(null);
	const [showArchived, setShowArchived] = (0, react.useState)(false);
	const { actions, dialogs, error: actionError } = useProjectActions({
		projects,
		t,
		pinSession,
		afterArchive: showProjects
	});
	const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList);
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running).map(([id]) => id).sort().join(","));
	(0, react.useEffect)(() => {
		projectsStore.refresh();
	}, [runningKey]);
	const { active, archived } = (0, react.useMemo)(() => {
		const needle = query.trim().toLowerCase();
		const sorted = sortProjects(needle.length === 0 ? projects : projects.filter((p) => p.title.toLowerCase().includes(needle) || p.folder.toLowerCase().includes(needle)), sort);
		return {
			active: sorted.filter((p) => !p.archived),
			archived: sorted.filter((p) => p.archived)
		};
	}, [
		projects,
		query,
		sort
	]);
	const newFromItems = [{
		type: "label",
		id: "from",
		text: t("page.newFrom")
	}, ...workspaces.map((workspace) => ({
		id: workspace.workspaceId,
		label: workspace.title,
		icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderIcon, { size: 16 })
	}))];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-page",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-inner",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsht-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: "dsht-title",
							children: t("page.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsht-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: sortOpen,
								onClose: () => setSortOpen(false),
								align: "end",
								portal: true,
								selection: "check",
								selectedId: sort,
								items: [
									"activity",
									"created",
									"title"
								].map((id) => ({
									id,
									label: t(SORT_LABELS[id])
								})),
								onSelect: (id) => {
									setSort(id);
									setSortOpen(false);
								},
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dsht-select-button",
									"aria-haspopup": "menu",
									"aria-expanded": sortOpen,
									onClick: () => setSortOpen(!sortOpen),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsht-select-label",
											children: t("page.sortBy")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(SORT_LABELS[sort]) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 14 })
									]
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsht-split",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlusIcon, { size: 14 }),
									onClick: () => setCreating({ folder: null }),
									children: t("page.new")
								}), workspaces.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
									open: newOpen,
									onClose: () => setNewOpen(false),
									align: "end",
									portal: true,
									items: newFromItems,
									onSelect: (id) => {
										setNewOpen(false);
										const workspace = workspaces.find((item) => item.workspaceId === id);
										if (workspace !== void 0) setCreating({ folder: workspace.path });
									},
									anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										className: "dsht-split-more",
										"aria-label": t("page.newFrom"),
										"aria-haspopup": "menu",
										"aria-expanded": newOpen,
										onClick: () => setNewOpen(!newOpen),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 14 })
									})
								})]
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
					actionError === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-error",
						children: actionError
					}),
					active.length === 0 ? status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-empty",
						children: projects.length === 0 ? t("page.empty") : t("page.noMatch")
					}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsht-grid",
						children: active.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectCard, {
							project,
							actions,
							openSession,
							t
						}, project.id))
					}),
					archived.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dsht-archived",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "dsht-archived-toggle",
							"aria-expanded": showArchived,
							onClick: () => setShowArchived(!showArchived),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
								size: 14,
								className: showArchived ? "" : "dsht-rotate"
							}), t("page.archived", { count: archived.length })]
						}), showArchived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsht-grid",
							children: archived.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectCard, {
								project,
								actions,
								openSession,
								t
							}, project.id))
						}) : null]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewProjectDialog, {
				open: creating !== null,
				initialFolder: creating?.folder ?? null,
				onClose: () => setCreating(null),
				onCreated: (project) => {
					threadsRevision.bump();
					openSession(project.mainSessionId);
				},
				workspaces,
				pickFolder,
				t
			}),
			dialogs
		]
	});
}
function ProjectCard({ project, actions, openSession, t }) {
	const [menuOpen, setMenuOpen] = (0, react.useState)(false);
	const open = () => {
		if (!project.archived) openSession(project.mainSessionId);
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: `dsht-project${menuOpen ? " is-menu-open" : ""}${project.archived ? " is-archived" : ""}`,
		role: "button",
		tabIndex: 0,
		onClick: open,
		onKeyDown: (event) => {
			if (event.key === "Enter" && event.target === event.currentTarget) open();
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-project-top",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-project-icon",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
						id: project.icon,
						size: 16
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsht-project-tools",
					onClick: (event) => event.stopPropagation(),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectMenu, {
						project,
						actions,
						t,
						onOpenChange: setMenuOpen
					})
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-project-title",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsht-project-name",
					children: project.title
				}), project.pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, {
					size: 14,
					className: "dsht-pin-on"
				}) : null]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-project-meta",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: relativeTime(t, project.lastActivity) }),
					project.threads > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("card.threads", { count: project.threads }) }) : null,
					project.running > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsht-running",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsht-pulse" }), t("card.running", { count: project.running })]
					}) : null
				]
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
async function setThreadArchived(threadId, archived) {
	await callHost(archived ? "threads.archive" : "threads.unarchive", { id: threadId });
	threadsRevision.bump();
}
async function stopThread(threadId) {
	await callHost("threads.stop", { id: threadId });
	threadsRevision.bump();
}
// src/client/SidebarProjects.tsx
let anchor = null;
const anchorListeners = /* @__PURE__ */ new Set();
function setAnchor(next) {
	if (next?.nav === anchor?.nav && next?.wide === anchor?.wide) return;
	anchor = next;
	for (const listener of anchorListeners) listener();
}
const subscribeAnchor = (listener) => {
	anchorListeners.add(listener);
	return () => {
		anchorListeners.delete(listener);
	};
};
/** For our "Projects" panel icon, which DSH renders inside the sidebar's panel <nav> (16px wide, 18px as a rail). */
function useSidebarAnchor(size) {
	const ref = (0, react.useRef)(null);
	(0, react.useLayoutEffect)(() => {
		const nav = ref.current?.closest("nav");
		if (!(nav instanceof HTMLElement)) return;
		setAnchor({
			nav,
			wide: size < 18
		});
		return () => {
			if (anchor?.nav === nav) setAnchor(null);
		};
	}, [size]);
	return ref;
}
/** The session DSH highlights: the one its main view holds, unless a panel is open. */
function useCurrentSession(props) {
	const panelActive = props.usePanelInfo((info) => info.activePanelId !== null);
	const held = props.useSessions((list) => Object.entries(list.byId).find(([, session]) => (session?.retainedBy?.mainView ?? 0) > 0)?.[0]);
	return panelActive ? void 0 : held;
}
/** Keep DSH's workspace list free of workspaces that would show nothing but project sessions. */
function useHideProjectWorkspaces(props) {
	const { mains, threads } = useKinds();
	const workspaces = props.useWorkspaces((snapshot) => snapshot.items);
	const archived = props.useWorkspaces((snapshot) => snapshot.archivedSessionIds);
	const sessions = props.useSessions((list) => list.byId);
	const current = useCurrentSession(props);
	(0, react.useEffect)(() => {
		setHiddenWorkspaces(projectOnlyWorkspaces(workspaces, sessions, new Set(archived ?? []), /* @__PURE__ */ new Set([...mains.keys(), ...threads]), current));
	}, [
		workspaces,
		archived,
		sessions,
		mains,
		threads,
		current
	]);
}
/**
* The `shell.overlay` entry: keeps the section's container right after the panel <nav>, and the
* workspace list free of project-only workspaces.
*/
function SidebarProjectsHost(props) {
	useHideProjectWorkspaces(props);
	const current = (0, react.useSyncExternalStore)(subscribeAnchor, () => anchor);
	const [container, setContainer] = (0, react.useState)(null);
	(0, react.useLayoutEffect)(() => {
		if (current === null || !current.wide) {
			setContainer(null);
			return;
		}
		const element = document.createElement("div");
		element.className = "dsht-side";
		current.nav.after(element);
		setContainer(element);
		return () => {
			element.remove();
		};
	}, [current]);
	return container === null ? null : (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidebarProjects, { ...props }), container);
}
const COLLAPSED_KEY = "dsh-threads.sidebar.projects.collapsed";
function readCollapsed() {
	try {
		return localStorage.getItem(COLLAPSED_KEY) === "1";
	} catch {
		return false;
	}
}
function SidebarProjects({ t, useWorkspaces, useSessions, useSessionStatus, usePanelInfo, openSession, pinSession, pickFolder }) {
	const { projects } = useProjects();
	const { mains } = useKinds();
	const [collapsed, setCollapsed] = (0, react.useState)(readCollapsed);
	const [expanded, setExpanded] = (0, react.useState)(false);
	const [creating, setCreating] = (0, react.useState)(false);
	const [menuFor, setMenuFor] = (0, react.useState)(null);
	const { actions, dialogs } = useProjectActions({
		projects,
		t,
		pinSession
	});
	const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList);
	const runningKey = useSessionStatus((statuses) => [...statuses].filter(([, state]) => state.running).map(([id]) => id).sort().join(","));
	const currentId = useCurrentSession({
		useSessions,
		usePanelInfo
	});
	(0, react.useEffect)(() => {
		projectsStore.refresh();
	}, [runningKey]);
	const toggle = () => {
		const next = !collapsed;
		setCollapsed(next);
		try {
			localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
		} catch {}
	};
	const rows = sidebarProjects(projects);
	const shown = expanded ? rows : rows.slice(0, 8);
	const running = new Set(runningKey.split(","));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-side-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dsht-side-label",
				"aria-expanded": !collapsed,
				onClick: toggle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("side.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
					size: 14,
					className: collapsed ? "dsht-rotate" : void 0
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dsht-side-icon",
				"aria-label": t("page.new"),
				title: t("page.new"),
				onClick: () => setCreating(true),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlusIcon, { size: 16 })
			})]
		}),
		collapsed ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dsht-side-list",
			role: "tree",
			"aria-label": t("side.title"),
			children: [rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dsht-side-more",
				onClick: () => setCreating(true),
				children: t("side.empty")
			}) : shown.map((project) => {
				const selected = currentId === project.mainSessionId;
				const threads = mains.get(project.mainSessionId)?.threads ?? project.threads;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "treeitem",
					"aria-selected": selected,
					tabIndex: 0,
					className: `dsht-side-row${selected ? " is-selected" : ""}${menuFor === project.id ? " is-menu-open" : ""}`,
					onClick: () => openSession(project.mainSessionId),
					onKeyDown: (event) => {
						if (event.key === "Enter" && event.target === event.currentTarget) openSession(project.mainSessionId);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsht-side-slot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowMark, {
								project,
								main: mains.get(project.mainSessionId),
								mainRunning: running.has(project.mainSessionId),
								t
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsht-side-title",
							children: project.title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsht-side-meta",
							children: [project.pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : null, threads > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["↳ ", threads] }) : null]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsht-side-actions",
							onClick: (event) => event.stopPropagation(),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectMenu, {
								project,
								actions,
								t,
								onOpenChange: (open) => setMenuFor(open ? project.id : null)
							})
						})
					]
				}, project.id);
			}), rows.length > 8 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dsht-side-more",
				onClick: () => setExpanded(!expanded),
				children: expanded ? t("side.less") : t("side.more", { count: rows.length - 8 })
			}) : null]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewProjectDialog, {
			open: creating,
			initialFolder: null,
			onClose: () => setCreating(false),
			onCreated: (project) => {
				threadsRevision.bump();
				openSession(project.mainSessionId);
			},
			workspaces,
			pickFolder,
			t
		}),
		dialogs
	] });
}
/** A raised hand when a thread waits on the user, a breathing dot while anything runs, else the project's icon. */
function RowMark({ project, main, mainRunning, t }) {
	const waiting = main?.waiting ?? 0;
	const threadsRunning = main?.running ?? project.running;
	if (waiting > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, {
		state: "waiting",
		label: t("badge.waiting", { count: waiting })
	});
	if (threadsRunning > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, {
		state: "running",
		label: t("badge.running", { count: threadsRunning })
	});
	if (mainRunning) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, {
		state: "running",
		label: t("side.mainRunning")
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "dsht-row-icon",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectIcon, {
			id: project.icon,
			size: 14
		})
	});
}
// src/client/styles.ts
const STYLE_ID = "@fky/dsh-threads/styles";
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
.dsht-list{box-sizing:border-box;display:flex;flex-direction:column;gap:4px;height:100%;min-height:0;overflow-y:auto;padding:6px 8px}
.dsht-list-fold{display:flex;align-items:center;gap:4px;width:100%;margin-top:6px;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;cursor:pointer}
.dsht-list-fold:hover{background:var(--dsht-press);color:var(--dsw-alias-label-secondary)}
.dsht-list-fold svg{transition:transform .15s var(--dsht-ease)}
.dsht-list-fold.is-open svg{transform:rotate(90deg)}
.dsht-items-archived{opacity:.72}
.dsht-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 10px 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}

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
	const act = (action) => {
		setBusy(true);
		action().catch(() => {}).finally(() => setBusy(false));
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-pane-head",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, { state: glyphState(thread, running) }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-pane-text",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-pane-title",
					title: thread.title,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsht-item-n",
						children: ["#", thread.n]
					}), thread.title]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsht-pane-meta",
					children: [
						thread.projectTitle === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: thread.projectTitle }),
						thread.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("pane.archived") }) : null,
						thread.worktree === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchChip, {
							branch: thread.worktree.branch,
							removed: thread.worktree.removed
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-pane-actions",
				children: [running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StopIcon, {}),
					disabled: busy,
					onClick: () => act(() => stopThread(threadId)),
					children: t("pane.stop")
				}) : thread.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchiveIcon, {}),
					disabled: busy,
					onClick: () => act(() => setThreadArchived(threadId, false)),
					children: t("pane.unarchive")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					icon: thread.resolved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReopenIcon, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CheckIcon, {}),
					disabled: busy,
					onClick: () => act(() => setThreadResolved(threadId, !thread.resolved)),
					children: thread.resolved ? t("pane.reopen") : t("pane.resolve")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchiveIcon, {}),
					label: t("pane.archive"),
					disabled: busy,
					onClick: () => act(() => setThreadArchived(threadId, true))
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExpandIcon, {}),
					onClick: () => openSession(threadId),
					children: t("pane.openMain")
				})]
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
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, { state: "resolved" }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsht-resolved-text",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("resolved.notice") }), t("resolved.hint")]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pill, {
				disabled: busy,
				onClick: () => {
					setBusy(true);
					setThreadResolved(sessionId, false).finally(() => setBusy(false));
				},
				children: t("resolved.reopen")
			})
		]
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
	const [showArchived, setShowArchived] = (0, react.useState)(false);
	if (role === void 0) return null;
	if (role.project === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dsht-tab",
		children: t("list.notProject")
	});
	const active = threads?.filter((thread) => !thread.archived) ?? [];
	const archived = threads?.filter((thread) => thread.archived) ?? [];
	const item = (thread) => {
		const state = glyphState(thread, running.has(thread.id));
		const report = thread.lastReport;
		const status = thread.archived ? t("pane.archived") : state === "running" ? t("status.running") : state === "resolved" ? t("list.resolved") : report === null ? t("list.noReport") : t(STATUS_KEYS[report.status] ?? "status.noReport");
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadItem, {
			n: thread.n,
			title: thread.title,
			state,
			status: `${status} · ${relativeTime(t, thread.updatedAt)}`,
			summary: state === "running" ? void 0 : report?.summary ?? thread.error ?? void 0,
			decision: state === "waiting" ? report?.decisions[0] : void 0,
			decisionLabel: t("card.decision"),
			branch: thread.worktree === null || thread.worktree.removed ? void 0 : thread.worktree.branch,
			openLabel: t("card.open"),
			onOpen: () => openThread(thread.id)
		}, thread.id);
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsht-list",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsht-list-head",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: role.project.title }), role.thread ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					variant: "ghost",
					onClick: () => openSession(role.project.mainSessionId),
					children: t("header.backToMain")
				}) : null]
			}),
			threads === void 0 ? null : active.length === 0 && archived.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-tab",
				children: t("list.empty")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-items",
				children: sortForList(active, running).map(item)
			}),
			archived.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: `dsht-list-fold${showArchived ? " is-open" : ""}`,
				"aria-expanded": showArchived,
				onClick: () => setShowArchived((open) => !open),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronIcon, {}), t("list.archived", { count: archived.length })]
			}), showArchived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsht-items dsht-items-archived",
				children: [...archived].sort((a, b) => b.n - a.n).map(item)
			}) : null] })
		]
	});
}
/** Waiting on the user first, then running, then the rest; resolved threads last; newest first within each. */
function sortForList(threads, running) {
	const rank = (thread) => {
		const state = glyphState(thread, running.has(thread.id));
		return state === "waiting" ? 0 : state === "running" ? 1 : state === "resolved" ? 3 : 2;
	};
	return [...threads].sort((a, b) => rank(a) - rank(b) || b.n - a.n);
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
	const count = threads?.filter((thread) => !thread.archived).length ?? 0;
	const active = threads?.filter((thread) => thread.status === "running" || thread.status === "starting").length ?? 0;
	const waiting = threads?.filter((thread) => glyphState(thread) === "waiting").length ?? 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
		size: "sm",
		variant: "ghost",
		icon: waiting > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, { state: "waiting" }) : active > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadGlyph, { state: "running" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadsIcon, { size: 14 }),
		onClick: openThreadsList,
		children: [t("header.threads", { count }), waiting > 0 ? ` · ${t("header.waiting", { count: waiting })}` : active > 0 ? ` · ${t("header.running", { count: active })}` : ""]
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
	const ref = useSidebarAnchor(size);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		ref,
		className: "dsht-panel-icon",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectsIcon, { size })
	});
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
	ctx.effect(() => sendLocaleToHost(() => ctx.locale.getLocale().active), "dsh-threads: host locale");
	ctx.on("locale/change", () => {
		callHost("ping").catch(() => {});
	});
	const openSession = (sessionId) => ctx.uiWorkspace.openSession(sessionId);
	const pinSession = (sessionId, pinned) => pinned ? ctx.workspaces.pinSession(sessionId) : ctx.workspaces.unpinSession(sessionId);
	const showProjects = () => ctx.layout.selectPanel(PANEL_ID);
	const pickFolder = async () => {
		const desktop = globalThis.__DSH_DIRECTORY_PICKER__;
		if (desktop !== void 0) return desktop.pick();
		try {
			return await ctx.uiWorkspace.pickDirectory();
		} catch (error) {
			if (String(error?.code ?? error).includes("unavailable")) return "unavailable";
			throw error;
		}
	};
	const openThread = (threadId) => ctx.sidebarRight.openResource(threadAddress(threadId), { kind: CHAT_TAB_KIND });
	const openThreadsList = () => ctx.sidebarRight.openTab(LIST_TAB_KIND);
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: PANEL_ID,
		locale: NS,
		inject: () => ({
			openSession,
			pinSession,
			pickFolder,
			showProjects
		})
	}, ProjectsPage));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: PANEL_ID,
		order: 20,
		locale: NS,
		label: () => t("panel")
	}, PanelIcon));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "dsh-threads-sidebar-projects",
		locale: NS,
		inject: () => ({
			openSession,
			pinSession,
			pickFolder
		})
	}, SidebarProjectsHost));
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
	ctx.effect(() => startNotifications({
		status: ctx.uiSession.sessionStatus,
		openSession,
		openThread,
		t
	}), "dsh-threads: notifications");
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