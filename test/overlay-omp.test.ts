import { describe, expect, test } from "bun:test";
import { Container, type Component, type TUI } from "@oh-my-pi/pi-tui";
import type { Theme } from "@oh-my-pi/pi-coding-agent";
import { TaskPlanOverlay } from "../extensions/task-plan-omp/overlay.ts";
import type { TaskPlan } from "../extensions/task-plan-omp/state.ts";

const taskPlan: TaskPlan = {
	objective: "Keep the composer interactive",
	plan: [{ text: "Preserve editor-slot focus", status: "current" }],
	constraints: [],
	findings: [],
};

const makeComponent = (): Component => ({ render: () => [] });

describe("TaskPlanOverlay editor-slot focus", () => {
	test("keeps a temporary selector focused and restores the composer when the overlay regains focus", () => {
		const composer = makeComponent();
		const treeSelector = makeComponent();
		const unrelated = makeComponent();
		const editorSlot = new Container();
		const unrelatedSlot = new Container();
		editorSlot.addChild(composer);
		unrelatedSlot.addChild(unrelated);

		let focused: Component | null = composer;
		const focusChanges: (Component | null)[] = [];
		let renderRequests = 0;
		const tui = {
			children: [editorSlot, unrelatedSlot],
			getFocused: () => focused,
			setFocus: (component: Component | null) => {
				focusChanges.push(component);
				focused = component;
			},
			requestRender: () => {
				renderRequests += 1;
			},
		} as unknown as TUI;
		const overlay = new TaskPlanOverlay({} as unknown as Theme, () => taskPlan, tui, composer);

		// `/tree` temporarily replaces the composer in the same editor slot.
		editorSlot.removeChild(composer);
		editorSlot.addChild(treeSelector);
		focused = treeSelector;

		expect(overlay.ownsOverlayFocusTarget(treeSelector)).toBe(true);
		expect(overlay.ownsOverlayFocusTarget(unrelated)).toBe(false);
		overlay.restoreEditorFocus();
		expect(focused).toBe(treeSelector);
		expect(focusChanges).toEqual([]);

		// Closing the selector restores the composer; overlay focus should then
		// be handed back to that composer, not stolen while the selector is active.
		editorSlot.removeChild(treeSelector);
		editorSlot.addChild(composer);
		focused = overlay;
		overlay.restoreEditorFocus();

		expect(focused).toBe(composer);
		expect(focusChanges).toEqual([composer]);
		expect(renderRequests).toBe(1);
	});
});

describe("TaskPlanOverlay list rendering", () => {
	test("renders constraints and findings as bulleted items with aligned continuation", () => {
		const theme = { fg: (_slot: string, value: string) => value } as unknown as Theme;
		const plan: TaskPlan = {
			objective: "Objective",
			plan: [{ text: "Step", status: "done" }],
			constraints: ["First constraint", "x".repeat(100)],
			findings: ["Single finding"],
		};
		const overlay = new TaskPlanOverlay(theme, () => plan, {} as unknown as TUI, null);
		const lines = overlay.render(40);

		expect(lines.some((line) => line.includes("· First constraint"))).toBe(true);
		expect(lines.some((line) => line.includes("· Single finding"))).toBe(true);
		const itemLines = lines.filter((line) => line.includes("x"));
		expect(itemLines.length).toBeGreaterThan(1);
		expect(itemLines[0]?.includes("·")).toBe(true);
		expect(itemLines[1]?.includes("·")).toBe(false);
		expect(itemLines[1]?.startsWith("│    ")).toBe(true);
	});
});
