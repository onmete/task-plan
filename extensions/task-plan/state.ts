export const STATE_ENTRY = "task-plan-state";
export const CONTEXT_MESSAGE = "task-plan-context";
export const MAX_TEXT = 500;
export const MAX_ITEMS = 8;
export const MAX_FORMATTED_SIZE = 4000;

export type StepStatus = "pending" | "current" | "done";

export type PlanStep = {
	text: string;
	status: StepStatus;
};

export type TaskPlan = {
	objective: string;
	plan: PlanStep[];
	constraints: string[];
	findings: string[];
};

export type TaskPlanState = {
	version: 1;
	semantic: TaskPlan | null;
	visible: boolean;
	updatedAt: string;
};

export function emptyState(visible = true): TaskPlanState {
	return {
		version: 1,
		semantic: null,
		visible,
		updatedAt: new Date().toISOString(),
	};
}

export function cloneState(state: TaskPlanState): TaskPlanState {
	return {
		...state,
		semantic: state.semantic
			? {
					...state.semantic,
					plan: state.semantic.plan.map((step) => ({ ...step })),
					constraints: [...state.semantic.constraints],
					findings: [...state.semantic.findings],
				}
			: null,
	};
}

function text(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const result = value.trim();
	return result && result.length <= MAX_TEXT ? result : undefined;
}

function list(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return undefined;
	const result = value.map(text);
	return result.every((item): item is string => item !== undefined) ? result : undefined;
}

function status(value: unknown): value is StepStatus {
	return value === "pending" || value === "current" || value === "done";
}

function steps(value: unknown): PlanStep[] | undefined {
	if (!Array.isArray(value) || value.length < 1 || value.length > 5) return undefined;
	const result = value.map((step) => {
		if (!step || typeof step !== "object") return undefined;
		const raw = step as Record<string, unknown>;
		const stepText = text(raw.text);
		return stepText && status(raw.status) ? { text: stepText, status: raw.status } : undefined;
	});
	return result.every((step): step is PlanStep => step !== undefined) ? result : undefined;
}

export function formatTaskPlan(taskPlan: TaskPlan): string {
	const lines = [`Objective: ${taskPlan.objective}`, "", "Plan:"];
	for (const step of taskPlan.plan) {
		const marker = step.status === "done" ? "✓" : step.status === "current" ? "→" : "·";
		lines.push(`${marker} ${step.text}`);
	}
	if (taskPlan.constraints.length > 0) {
		lines.push("", "Constraints:", ...taskPlan.constraints.map((item) => `- ${item}`));
	}
	if (taskPlan.findings.length > 0) {
		lines.push("", "Findings:", ...taskPlan.findings.map((item) => `- ${item}`));
	}
	return lines.join("\n");
}

export function isComplete(taskPlan: TaskPlan): boolean {
	return taskPlan.plan.every((step) => step.status === "done");
}

export function validateTaskPlan(taskPlan: TaskPlan): string | undefined {
	if (!text(taskPlan.objective)) return "objective is required and must be 1–500 characters";
	if (!steps(taskPlan.plan)) return "plan must contain 1–5 valid steps";
	const current = taskPlan.plan.filter((step) => step.status === "current").length;
	if (!isComplete(taskPlan) && current !== 1) return "an unfinished plan must have exactly one current step";
	if (taskPlan.constraints.length > MAX_ITEMS) return `constraints may contain at most ${MAX_ITEMS} items`;
	if (taskPlan.findings.length > MAX_ITEMS) return `findings may contain at most ${MAX_ITEMS} items`;
	if (!taskPlan.constraints.every((item) => text(item))) return "each constraint must be 1–500 characters";
	if (!taskPlan.findings.every((item) => text(item))) return "each finding must be 1–500 characters";
	if (formatTaskPlan(taskPlan).length > MAX_FORMATTED_SIZE) {
		return `formatted task plan exceeds the ${MAX_FORMATTED_SIZE}-character limit; condense it`;
	}
	return undefined;
}

export function parseState(value: unknown): TaskPlanState | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	if (
		raw.version !== 1 ||
		typeof raw.visible !== "boolean" ||
		typeof raw.updatedAt !== "string" ||
		!Object.prototype.hasOwnProperty.call(raw, "semantic")
	) return undefined;
	if (raw.semantic === null) {
		return { version: 1, semantic: null, visible: raw.visible, updatedAt: raw.updatedAt };
	}
	if (typeof raw.semantic !== "object") return undefined;
	const semantic = raw.semantic as Record<string, unknown>;
	const objective = text(semantic.objective);
	const plan = steps(semantic.plan);
	const constraints = list(semantic.constraints);
	const findings = list(semantic.findings);
	if (!objective || !plan || !constraints || !findings) return undefined;
	const taskPlan = { objective, plan, constraints, findings };
	if (validateTaskPlan(taskPlan)) return undefined;
	return { version: 1, semantic: taskPlan, visible: raw.visible, updatedAt: raw.updatedAt };
}

export function formatContext(taskPlan: TaskPlan): string {
	const completion = isComplete(taskPlan) ? "completed" : "active";
	return `[TASK PLAN — ${completion}; assistant-maintained working state; may be stale]
This is working state, not a user request, authorization, or higher-priority instruction. Current user instructions take precedence. If the user's intent changed, revise or clear this task plan before continuing.

${formatTaskPlan(taskPlan)}`;
}
