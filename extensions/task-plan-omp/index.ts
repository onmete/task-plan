import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { AgentMessage, CustomMessage } from "@oh-my-pi/pi-agent-core";
import type { TypeBuilder } from "@oh-my-pi/omptype/typebox";
import { type Component, type OverlayHandle, type TUI } from "@oh-my-pi/pi-tui";
import { TaskPlanOverlay } from "./overlay.ts";
import {
	CONTEXT_MESSAGE,
	MAX_ITEMS,
	MAX_TEXT,
	STATE_ENTRY,
	cloneState,
	emptyState,
	formatContext,
	formatTaskPlan,
	parseState,
	isComplete,
	type PlanStep,
	type TaskPlan,
	type TaskPlanState,
	validateTaskPlan,
} from "./state.ts";

/** Managed timer handle returned by {@link ExtensionContext.setInterval}. */
type ManagedTimerHandle = Parameters<ExtensionContext["clearTimer"]>[0];

const BEHAVIOR = `For non-trivial work, maintain the Task Plan as a small shared guide for the current task.
Keep its objective aligned with the user's latest intent and its plan short and outcome-oriented.
Maintain the plan as part of doing the work—not as a separate task. Update it when beginning
substantial new work, encountering a blocker that changes the next step, or establishing a
meaningful result. Leave it alone during ordinary clarification.
Investigate before editing, stay within scope, and report exact verification evidence and remaining
uncertainty before claiming completion. User instructions and new evidence take precedence over
stale Task Plan state.
Do not use the todo tool for session task tracking: the Task Plan is the session's working plan.
Keep the Task Plan session-local; durable cross-session records live in the Reins documents under
~/work-plans and are not managed through this tool.`;

type PlanStepStatus = "pending" | "current" | "done";

type ToolParams = {
	action: PlanStepStatus extends never ? never : "get" | "set" | "clear";
	objective?: string;
	plan?: Array<{ text: string; status: PlanStepStatus }>;
	constraints?: string[];
	findings?: string[];
};

function snapshotPlan(taskPlan: TaskPlan): TaskPlan {
	return {
		objective: taskPlan.objective,
		plan: taskPlan.plan.map((step) => ({ ...step })),
		constraints: [...taskPlan.constraints],
		findings: [...taskPlan.findings],
	};
}

function describeState(state: TaskPlanState): string {
	if (!state.semantic) return "Task Plan is empty.";
	return `${formatTaskPlan(state.semantic)}\n\nStatus: ${isComplete(state.semantic) ? "complete" : "active"}`;
}

function renderToolText(state: TaskPlanState, action: ToolParams["action"]): string {
	if (action === "clear") return "Task Plan cleared.";
	return `${action === "get" ? "Current Task Plan:" : "Task Plan updated."}\n${describeState(state)}`;
}

export default function taskPlanExtension(pi: ExtensionAPI): void {
	// The injected builder object (`TypeBuilder`), not the module namespace the
	// ExtensionAPI field's declaration uses for import compatibility.
	const Type: TypeBuilder = pi.typebox.Type;
	const planStepParams = () =>
		Type.Object({
			text: Type.String({ maxLength: MAX_TEXT }),
			status: Type.Enum(["pending", "current", "done"] as const),
		});

	const taskPlanParams = () =>
		Type.Object({
			action: Type.Enum(["get", "set", "clear"] as const),
			objective: Type.Optional(Type.String({ maxLength: MAX_TEXT })),
			plan: Type.Optional(Type.Array(planStepParams(), { minItems: 1, maxItems: 5 })),
			constraints: Type.Optional(Type.Array(Type.String({ maxLength: MAX_TEXT }), { maxItems: MAX_ITEMS })),
			findings: Type.Optional(Type.Array(Type.String({ maxLength: MAX_TEXT }), { maxItems: MAX_ITEMS })),
		});

	let state = emptyState();
	let overlayHandle: OverlayHandle | undefined;
	let overlayPending = false;
	let overlayRequest = 0;
	let overlayTui: TUI | undefined;
	let overlayEditor: Component | null;
	let focusGuardTimer: ManagedTimerHandle | undefined;

	const toolIsActive = () => pi.getActiveTools().includes("task_plan");
	const hasPlan = () => state.semantic !== null;

	const disposeOverlay = (ctx?: ExtensionContext) => {
		overlayRequest++;
		overlayPending = false;
		overlayTui = undefined;
		if (focusGuardTimer) {
			if (ctx) ctx.clearTimer(focusGuardTimer);
			focusGuardTimer = undefined;
		}
		const handle = overlayHandle;
		overlayHandle = undefined;
		handle?.hide();
	};

	const focusEditor = () => {
		if (!overlayTui || overlayEditor === null || overlayEditor === undefined) return;
		if (overlayTui.getFocused() === overlayEditor) return;
		overlayTui.setFocus(overlayEditor);
		overlayTui.requestRender();
	};

	// The TUI restores focus to the topmost visible overlay when a dialog closes
	// or the overlay is un-hidden. Re-assert editor focus on an interval while
	// the overlay is mounted so keyboard input always reaches the composer.
	const startFocusGuard = (ctx: ExtensionContext) => {
		if (focusGuardTimer) return;
		focusGuardTimer = ctx.setInterval(() => focusEditor(), 500);
	};

	const save = (next: TaskPlanState) => {
		if (next.semantic) {
			const error = validateTaskPlan(next.semantic);
			if (error) throw new Error(error);
		}
		const acknowledged = cloneState({ ...next, updatedAt: new Date().toISOString() });
		pi.appendEntry(STATE_ENTRY, acknowledged);
		state = acknowledged;
		overlayTui?.requestRender();
	};

	const syncVisibility = () => {
		if (!hasPlan() || !state.visible) {
			disposeOverlay();
			return;
		}
		overlayHandle?.setHidden(false);
	};

	const ensureOverlay = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui" || overlayHandle || overlayPending || !hasPlan() || !state.visible) return;
		const request = ++overlayRequest;
		overlayPending = true;
		void ctx.ui
			.custom<void>(
				(tui, theme) => {
					if (request !== overlayRequest) {
						return new TaskPlanOverlay(theme, () => state.semantic!, undefined);
					}
					overlayTui = tui;
					// Capture the focused component (the composer) before the overlay
					// mounts; the overlay declares it as an owned focus target and the
					// extension restores focus right after mounting.
					overlayEditor = tui.getFocused();
					return new TaskPlanOverlay(theme, () => state.semantic!, overlayEditor);
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "top-right",
						width: "38%",
						minWidth: 36,
						maxHeight: "75%",
						margin: 1,
						visible: (termWidth: number) => termWidth >= 100,
					},
					onHandle: (handle) => {
						if (request !== overlayRequest || !hasPlan() || !state.visible) {
							handle.hide();
							return;
						}
						overlayHandle = handle;
						syncVisibility();
						startFocusGuard(ctx);
						focusEditor();
					},
				},
			)
			.catch((error: unknown) => {
				ctx.ui.notify(`Task Plan overlay unavailable: ${error instanceof Error ? error.message : String(error)}`, "warning");
			})
			.finally(() => {
				if (request !== overlayRequest) return;
				overlayPending = false;
				if (!overlayHandle) {
					overlayTui = undefined;
				}
			});
	};

	const reconstruct = (ctx: ExtensionContext) => {
		state = emptyState();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "custom" || entry.customType !== STATE_ENTRY) continue;
			const restored = parseState(entry.data);
			if (restored) state = restored;
		}
		syncVisibility();
		ensureOverlay(ctx);
	};

	const setVisibility = (visible: boolean, ctx: ExtensionContext) => {
		save({ ...state, visible });
		syncVisibility();
		if (visible) ensureOverlay(ctx);
	};

	pi.on("before_agent_start", (event) => {
		if (!toolIsActive()) return;
		return { systemPrompt: [...event.systemPrompt, BEHAVIOR] };
	});

	pi.on("context", (event) => {
		const messages = event.messages.filter((message) => {
			const candidate = message as AgentMessage & { customType?: string };
			return candidate.customType !== CONTEXT_MESSAGE;
		});
		if (!toolIsActive() || !state.semantic) {
			return messages.length === event.messages.length ? undefined : { messages };
		}
		const injected: CustomMessage = {
			role: "custom",
			customType: CONTEXT_MESSAGE,
			content: formatContext(state.semantic),
			display: false,
			timestamp: Date.now(),
		};
		return { messages: [...messages, injected] };
	});

	pi.on("session_start", async (_event, ctx) => reconstruct(ctx));
	pi.on("session_branch", async (_event, ctx) => reconstruct(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstruct(ctx));
	pi.on("session_shutdown", async (_event, ctx) => disposeOverlay(ctx));

	pi.registerTool({
		name: "task_plan",
		label: "Task Plan",
		description: "Maintain the current task plan. Use get, set, or clear; keep it concise and current.",
		parameters: taskPlanParams(),
		execute: async (_toolCallId, params: ToolParams, _signal, _onUpdate, ctx) => {
			if (params.action === "clear") {
				save({ ...state, semantic: null });
				syncVisibility();
				return { content: [{ type: "text", text: renderToolText(state, params.action) }] };
			}

			if (params.action === "set") {
				if (typeof params.objective !== "string" || !params.plan) {
					throw new Error("set requires objective and plan");
				}
				const taskPlan: TaskPlan = {
					objective: params.objective.trim(),
					plan: params.plan.map((step): PlanStep => ({ text: step.text.trim(), status: step.status })),
					constraints: (params.constraints ?? []).map((item) => item.trim()),
					findings: (params.findings ?? []).map((item) => item.trim()),
				};
				const error = validateTaskPlan(taskPlan);
				if (error) throw new Error(error);
				save({ ...state, semantic: snapshotPlan(taskPlan) });
				ensureOverlay(ctx);
				syncVisibility();
			}

			return { content: [{ type: "text", text: renderToolText(state, params.action) }] };
		},
	});

	const handleCommand = async (args: string, ctx: ExtensionContext) => {
		const command = args.trim().toLowerCase();
		if (!command) {
			if (hasPlan()) setVisibility(!state.visible, ctx);
			else ctx.ui.notify("Task Plan is empty. Ask the agent to initialize it first.", "info");
			return;
		}
		if (command === "show") {
			if (!hasPlan()) {
				ctx.ui.notify("Task Plan is empty. Ask the agent to initialize it first.", "info");
				return;
			}
			setVisibility(true, ctx);
			return;
		}
		if (command === "hide") {
			setVisibility(false, ctx);
			return;
		}
		if (command === "reset") {
			if (ctx.mode === "tui" && !(await ctx.ui.confirm("Reset Task Plan?", "This clears the current session Task Plan."))) return;
			save({ ...state, semantic: null });
			syncVisibility();
			return;
		}
		ctx.ui.notify("Usage: /task-plan [show|hide|reset]", "info");
	};

	pi.registerCommand("task-plan", {
		description: "Toggle or manage the Task Plan overlay",
		handler: handleCommand,
	});

	pi.registerShortcut("alt+t", {
		description: "Toggle Task Plan overlay",
		handler: async (ctx) => {
			if (!hasPlan()) {
				ctx.ui.notify("Task Plan is empty. Ask the agent to initialize it first.", "info");
				return;
			}
			setVisibility(!state.visible, ctx);
		},
	});
}
