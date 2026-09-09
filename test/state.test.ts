import assert from "node:assert/strict";
import {
	MAX_FORMATTED_SIZE,
	emptyState,
	formatTaskPlan,
	isComplete,
	parseState,
	validateTaskPlan,
	type TaskPlan,
} from "../extensions/task-plan/state.ts";

const active: TaskPlan = {
	objective: "Ship the fix",
	plan: [
		{ text: "Investigate", status: "done" },
		{ text: "Implement", status: "current" },
		{ text: "Verify", status: "pending" },
	],
	constraints: ["Keep the change focused"],
	findings: ["The old behavior is reproducible"],
};

assert.equal(validateTaskPlan(active), undefined);
assert.equal(isComplete(active), false);
assert.match(formatTaskPlan(active), /→ Implement/);
assert.match(formatTaskPlan(active), /Findings:/);

const complete = { ...active, plan: active.plan.map((step) => ({ ...step, status: "done" as const })) };
assert.equal(validateTaskPlan(complete), undefined);
assert.equal(isComplete(complete), true);
assert.equal(validateTaskPlan({ ...active, plan: active.plan.map((step) => ({ ...step, status: "pending" as const })) }),
	"an unfinished plan must have exactly one current step");
assert.equal(validateTaskPlan({ ...active, objective: "" }), "objective is required and must be 1–500 characters");
assert.equal(validateTaskPlan({ ...active, plan: [] }), "plan must contain 1–5 valid steps");

const restored = parseState({ ...emptyState(), semantic: active });
assert.deepEqual(restored?.semantic, active);
assert.equal(parseState({ ...emptyState(), semantic: { ...active, plan: [] } }), undefined);
assert.equal(parseState({ ...emptyState(), semantic: null })?.semantic, null);
assert.equal(parseState({ ...emptyState(), semantic: { ...active, objective: "x".repeat(501) } }), undefined);
assert.equal(parseState({ version: 1, visible: true, updatedAt: new Date().toISOString(), semantic: { objective: "old", goal: "legacy" } }), undefined);

const oversized = { ...active, objective: "x".repeat(500), findings: Array(8).fill("y".repeat(500)) };
assert(formatTaskPlan(oversized).length > MAX_FORMATTED_SIZE);
assert.match(validateTaskPlan(oversized) ?? "", /4000-character/);

console.log("Task Plan state tests passed");
