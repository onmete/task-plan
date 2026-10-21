import { Container, type Component, type TUI } from "@oh-my-pi/pi-tui";
import type { Theme } from "@oh-my-pi/pi-coding-agent";
import { Ellipsis, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@oh-my-pi/pi-tui";
import type { TaskPlan } from "./state.ts";

/**
 * Passive top-right overlay. OMP treats custom overlays as focus owners, so this
 * component delegates focus to the active editor slot (including temporary
 * selectors such as `/tree`) and restores composer focus only when it regains focus.
 */
export class TaskPlanOverlay implements Component {
	private readonly ownedTarget: Component | null;
	private focusContainer: Container | undefined;

	constructor(
		private readonly theme: Theme,
		private readonly getTaskPlan: () => TaskPlan,
		private readonly tui: TUI,
		ownedTarget: Component | null,
	) {
		this.ownedTarget = ownedTarget;
		this.focusContainer = ownedTarget ? this.findFocusContainer(ownedTarget) : undefined;
	}

	ownsOverlayFocusTarget(target: Component): boolean {
		if (this.focusContainer) return this.focusContainer.children.includes(target);
		if (target === this.ownedTarget) {
			this.focusContainer = this.findFocusContainer(target);
			return true;
		}
		if (!this.ownedTarget) return false;
		const focused = this.tui.getFocused();
		if (focused !== this && focused !== this.ownedTarget) return false;
		const focusContainer = this.findFocusContainer(target);
		if (!focusContainer) return false;
		this.focusContainer = focusContainer;
		return true;
	}

	restoreEditorFocus(): void {
		const editor = this.ownedTarget;
		if (!editor || this.tui.getFocused() !== this) return;
		if (this.focusContainer) {
			if (!this.focusContainer.children.includes(editor)) return;
		} else if (!this.tui.children.includes(editor)) {
			return;
		}
		this.tui.setFocus(editor);
		this.tui.requestRender();
	}

	private findFocusContainer(target: Component): Container | undefined {
		return this.tui.children.find(
			(child): child is Container => child instanceof Container && child.children.includes(target),
		);
	}

	render(width: number): readonly string[] {
		const taskPlan = this.getTaskPlan();
		const innerWidth = Math.max(4, width - 2);
		const contentWidth = Math.max(1, innerWidth - 2);
		const lines: string[] = [];
		const border = (value: string) => this.theme.fg("border", value);
		const pad = (value: string) => {
			const clipped = truncateToWidth(value, contentWidth, Ellipsis.Ascii, true);
			return ` ${clipped}${" ".repeat(Math.max(0, contentWidth - visibleWidth(clipped)))} `;
		};
		const line = (value = "") => lines.push(border("│") + pad(value) + border("│"));

		lines.push(border(`╭${"─".repeat(innerWidth)}╮`));
		line(this.theme.fg("accent", "Task Plan"));
		lines.push(border(`├${"─".repeat(innerWidth)}┤`));

		const addField = (label: string, value: string | string[] | undefined) => {
			if (!value || (Array.isArray(value) && value.length === 0)) return;
			line(this.theme.fg("accent", label));
			const values = Array.isArray(value) ? value : [value];
			for (const item of values) {
				for (const wrapped of wrapTextWithAnsi(item, Math.max(1, contentWidth - 1))) line(` ${wrapped}`);
			}
		};

		const addList = (label: string, items: string[]) => {
			if (items.length === 0) return;
			line(this.theme.fg("accent", label));
			for (const item of items) {
				const wrapped = wrapTextWithAnsi(item, Math.max(1, contentWidth - 3));
				for (const [index, segment] of wrapped.entries()) {
					line(index === 0 ? ` · ${segment}` : `   ${segment}`);
				}
			}
		};

		addField("Objective", taskPlan.objective);
		addField(
			"Plan",
			taskPlan.plan.map((step) => {
				const marker = step.status === "done" ? "✓" : step.status === "current" ? "→" : "·";
				return `${marker} ${step.text}`;
			}),
		);
		addList("Constraints", taskPlan.constraints);
		addList("Findings", taskPlan.findings);
		if (taskPlan.plan.every((step) => step.status === "done")) line(this.theme.fg("success", "Completed"));
		line();
		line(this.theme.fg("dim", "Alt+T / /task-plan to hide"));
		lines.push(border(`╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
}
