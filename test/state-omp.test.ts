import { describe, expect, test } from "bun:test";
import {
	MAX_FORMATTED_SIZE,
	emptyState,
	formatTaskPlan,
	isComplete,
	parseState,
	validateTaskPlan,
	type TaskPlan,
} from "../extensions/task-plan-omp/state.ts";

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

describe("validateTaskPlan", () => {
	test("accepts an active plan", () => {
		expect(validateTaskPlan(active)).toBeUndefined();
	});

	test("accepts a complete plan", () => {
		const complete = { ...active, plan: active.plan.map((step) => ({ ...step, status: "done" as const })) };
		expect(validateTaskPlan(complete)).toBeUndefined();
		expect(isComplete(complete)).toBe(true);
	});

	test("rejects a plan with no current step", () => {
		expect(validateTaskPlan({ ...active, plan: active.plan.map((step) => ({ ...step, status: "pending" as const })) })).toBe(
			"an unfinished plan must have exactly one current step",
		);
	});

	test("rejects an empty objective", () => {
		expect(validateTaskPlan({ ...active, objective: "" })).toBe("objective is required and must be 1–500 characters");
	});

	test("rejects an empty plan", () => {
		expect(validateTaskPlan({ ...active, plan: [] })).toBe("plan must contain 1–5 valid steps");
	});

	test("reports the formatted-size budget when exceeded", () => {
		const oversized = { ...active, objective: "x".repeat(500), findings: Array(8).fill("y".repeat(500)) };
		expect(formatTaskPlan(oversized).length).toBeGreaterThan(MAX_FORMATTED_SIZE);
		expect(validateTaskPlan(oversized) ?? "").toMatch(/4000-character/);
	});
});

describe("isComplete", () => {
	test("is false while steps remain", () => {
		expect(isComplete(active)).toBe(false);
	});
});

describe("formatTaskPlan", () => {
	test("marks the current step and lists findings", () => {
		expect(formatTaskPlan(active)).toMatch(/→ Implement/);
		expect(formatTaskPlan(active)).toMatch(/Findings:/);
	});
});

describe("parseState", () => {
	test("round-trips a valid plan", () => {
		const restored = parseState({ ...emptyState(), semantic: active });
		expect(restored?.semantic).toEqual(active);
	});

	test("rejects an invalid nested plan", () => {
		expect(parseState({ ...emptyState(), semantic: { ...active, plan: [] } })).toBeUndefined();
	});

	test("accepts a null semantic", () => {
		expect(parseState({ ...emptyState(), semantic: null })?.semantic).toBeNull();
	});

	test("rejects an over-length objective", () => {
		expect(parseState({ ...emptyState(), semantic: { ...active, objective: "x".repeat(501) } })).toBeUndefined();
	});

	test("rejects an unknown version shape", () => {
		expect(
			parseState({ version: 1, visible: true, updatedAt: new Date().toISOString(), semantic: { objective: "old", goal: "legacy" } }),
		).toBeUndefined();
	});
});
