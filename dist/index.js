import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { randomUUID } from "node:crypto";
import { boundContextSummary, createUserMessage } from "@deepseek-ai/dsh-llm";
// package.json
var name$1 = "@fky/dsh-threads";
var version = "0.0.0";
// src/config.ts
const Config = z.object({
	maxRunning: z.natural().min(1).default(1).description("How many threads one main conversation may run at once."),
	maxAutoWakes: z.natural().default(5).description("Consecutive automatic wake-ups of the main conversation before reports wait for the user."),
	noteMaxChars: z.natural().min(80).default(400).description("Longest report delivered back to the main conversation."),
	summaryMaxChars: z.natural().min(40).default(300).description("Longest summary a thread may submit through thread_report."),
	proposalTtlDays: z.natural().min(1).default(7).description("Days before an unstarted thread proposal expires."),
	maxProposalsPerTurn: z.natural().min(1).default(3).description("Most thread proposals the main conversation may make in one turn."),
	inheritPermissionPreset: z.boolean().default(true).description("Give each thread the main conversation's current permission preset instead of the user default.")
});
// src/probe.ts
/** Services the M1 design depends on (see docs/IMPLEMENTATION.md §二). */
const PROBED_SERVICES = [
	"agents",
	"agentPresets",
	"commands",
	"connection",
	"permissionPresets",
	"sessionController",
	"sessionProjections",
	"sessionQuery",
	"sessions",
	"sessionTitle",
	"storageDomain",
	"systemPrompt",
	"userQuestions",
	"webServer",
	"workspaceRegistry",
	"worktrees"
];
/**
* Read an optional service without declaring it in `inject`.
* Cordis throws for a service that is not provided, so a miss becomes `undefined`.
*/
function optional(ctx, name) {
	try {
		return ctx.get(name);
	} catch {
		return;
	}
}
/** Map each service name to whether the host provides it. */
function probeServices(get, names = PROBED_SERVICES) {
	const result = {};
	for (const name of names) {
		let value;
		try {
			value = get(name);
		} catch {
			value = void 0;
		}
		result[name] = value !== void 0 && value !== null;
	}
	return result;
}
// src/rpc.ts
/**
* Browser ↔ host calls for the panel (src/client).
*
* One exact Fetch route under the shared `/api` channel. `connection.rpc.handle` is not
* usable from a third-party plugin: it registers through the caller's `ctx.webServer`,
* which is not visible to profile bundles on Desktop. `connection.fetch.register` is
* dispatched by the Connection plugin itself and admits only the owner principal.
*/
const RPC_PATH = "/api/dsh-threads";
async function dispatchRpc(handlers, request) {
	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "body is not JSON" }, { status: 400 });
	}
	const handler = typeof body.method === "string" ? handlers[body.method] : void 0;
	if (handler === void 0) return Response.json({ error: `unknown method ${JSON.stringify(body.method)}` }, { status: 404 });
	try {
		return Response.json({ result: await handler(body.payload) });
	} catch (error) {
		return Response.json({ error: String(error) }, { status: 500 });
	}
}
function registerRpc(connection, handlers) {
	return connection.fetch.register({
		path: RPC_PATH,
		methods: ["POST"],
		requestBody: "buffered",
		fetch: (request) => dispatchRpc(handlers, request)
	});
}
// src/source.ts
/** Message source kind for everything this plugin puts into a session inbox. */
const SOURCE_KIND = "dsh-threads";
// src/state.ts
function createProbeState(plugin) {
	return {
		plugin,
		loadedAt: (/* @__PURE__ */ new Date()).toISOString(),
		rpcRegistered: false,
		rpcError: null,
		rpcPings: 0,
		agentCreated: 0,
		recentCreated: [],
		probeSessions: /* @__PURE__ */ new Map()
	};
}
// src/spike.ts
const PROBE_TITLE = "dsh-threads probe";
const PROBE_TASK = "This is a dsh-threads M0 probe. Reply with the single word OK and do nothing else.";
async function spawnProbe(ctx, caller) {
	const controller = optional(ctx, "sessionController");
	if (controller === void 0) return {
		ok: false,
		step: "inject",
		error: "sessionController is not available to this plugin"
	};
	const workspace = optional(ctx, "workspaceRegistry")?.list().find((candidate) => candidate.sessionIds.includes(caller.id));
	let sessionId;
	let agentPreset;
	try {
		const created = await controller.create({
			...workspace === void 0 ? {} : { workspaceId: workspace.id },
			sessionId: `session-${randomUUID()}`
		});
		sessionId = created.sessionId;
		agentPreset = created.agentPreset ?? null;
	} catch (error) {
		return {
			ok: false,
			step: "create",
			error: String(error)
		};
	}
	const resolved = await controller.resolveAgent(sessionId);
	if ("error" in resolved) return {
		ok: false,
		step: "resolveAgent",
		error: resolved.error.message,
		sessionId
	};
	let renamed = false;
	try {
		optional(ctx, "sessionTitle")?.rename(resolved.agent.session, PROBE_TITLE);
		renamed = true;
	} catch {}
	try {
		resolved.agent.followup(createUserMessage({
			content: [{
				type: "text",
				text: PROBE_TASK
			}],
			source: {
				kind: SOURCE_KIND,
				form: "notice",
				summary: boundContextSummary(PROBE_TITLE)
			}
		}));
	} catch (error) {
		return {
			ok: false,
			step: "followup",
			error: String(error),
			sessionId
		};
	}
	return {
		ok: true,
		sessionId,
		workspaceId: workspace?.id ?? null,
		agentPreset,
		renamed
	};
}
// src/tools/thread-status.ts
function registerThreadStatusTool(ctx, state) {
	return ctx.tools.register(defineTool({
		name: "thread_status",
		description: "dsh-threads (M0 probe): report whether the dsh-threads plugin is loaded and which DSH services it can reach. Set spawn to true only when the user explicitly asks to test opening a thread session; it creates one real session.",
		parameters: { spawn: {
			type: "boolean",
			description: "Create one probe session through the same path real threads will use."
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			const spawn = args.spawn === true && exec.agent !== void 0 ? await spawnProbe(ctx, exec.agent) : void 0;
			if (spawn?.ok === true) state.probeSessions.set(spawn.sessionId, "starting");
			const report = {
				plugin: state.plugin,
				loadedAt: state.loadedAt,
				caller: exec.agent?.id ?? null,
				services: probeServices((name) => ctx.get(name)),
				rpcRegistered: state.rpcRegistered,
				rpcError: state.rpcError,
				rpcPings: state.rpcPings,
				agentCreated: {
					count: state.agentCreated,
					recent: state.recentCreated
				},
				probeSessions: Object.fromEntries(state.probeSessions),
				...spawn === void 0 ? {} : { spawn }
			};
			return JSON.stringify(report, null, 2);
		}
	}));
}
// src/index.ts
const name = "dsh-threads";
const inject = ["tools"];
const RECENT_CREATED = 5;
function apply(ctx, _config) {
	const state = createProbeState({
		name: name$1,
		version
	});
	ctx.on("agent/created", ({ agent, source }) => {
		state.agentCreated += 1;
		state.recentCreated = [{
			id: agent.id,
			source
		}, ...state.recentCreated].slice(0, RECENT_CREATED);
	});
	ctx.on("agent/status", ({ agent, status }) => {
		if (state.probeSessions.has(agent.id)) state.probeSessions.set(agent.id, status);
	});
	registerThreadStatusTool(ctx, state);
	ctx.inject(["connection"], (scoped) => {
		const connection = optional(scoped, "connection");
		if (connection === void 0) return;
		try {
			scoped.effect(() => registerRpc(connection, { ping: () => {
				state.rpcPings += 1;
				return {
					ok: true,
					plugin: state.plugin,
					loadedAt: state.loadedAt,
					pings: state.rpcPings
				};
			} }), "dsh-threads: /api/dsh-threads");
			state.rpcRegistered = true;
		} catch (error) {
			state.rpcError = String(error);
		}
	});
}
export { Config, apply, inject, name };
