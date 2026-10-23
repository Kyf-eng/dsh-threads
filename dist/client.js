window.__ModuleLoader__.load({
	id: "@fky/dsh-threads",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
// src/client/index.tsx
/** Tab implementation id: the package name, as the right sidebar expects. */
const TAB_ID = "@fky/dsh-threads";
const TAB_KIND = "dsh-threads";
/**
* Host route, relative to the page like DSH's own Connection calls: on Desktop the page is
* dsh-app://app/ and the shell forwards it to the Host with its cookie; on Web it is same-origin.
* Must match RPC_PATH in src/rpc.ts.
*/
const RPC_URL = "api/dsh-threads";
const inject = ["slots", "sidebarRightTabs"];
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
	if (!response.ok) throw new Error(`HTTP ${response.status}${body.error === void 0 ? "" : `: ${body.error}`}`);
	return body.result;
}
const isZh = () => typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");
const title = () => isZh() ? "讨论串" : "Threads";
function ThreadsTab({ sessionId, ping }) {
	const [rpc, setRpc] = (0, react.useState)("…");
	(0, react.useEffect)(() => {
		let live = true;
		ping().then((value) => {
			if (live) setRpc(JSON.stringify(value));
		}, (error) => {
			if (live) setRpc(`failed: ${String(error)}`);
		});
		return () => {
			live = false;
		};
	}, [ping]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: {
			padding: 12,
			fontSize: 13,
			lineHeight: 1.6
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: { fontWeight: 600 },
				children: title()
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: isZh() ? "M0 占位：讨论串列表在 M2 实现。" : "M0 placeholder: the thread list arrives in M2." }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: ["session: ", sessionId ?? "—"] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: ["host RPC: ", rpc] })
		]
	});
}
function apply(root) {
	const ctx = root;
	const ping = () => callHost("ping");
	ctx.effect(() => ctx.sidebarRightTabs.register({
		id: TAB_ID,
		kind: TAB_KIND,
		title,
		guide: [{
			id: "open",
			order: 70,
			title,
			description: () => isZh() ? "主对话开出的讨论串" : "Threads opened by the main conversation"
		}]
	}), "dsh-threads: sidebar tab");
	ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
		name: "sidebar.right.pane.tab",
		key: TAB_ID,
		inject: () => ({ ping })
	}, ThreadsTab));
}
exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});