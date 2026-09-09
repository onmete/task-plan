import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component } from "@earendil-works/pi-tui";
import type { TaskPlan } from "./state.ts";

export class TaskPlanOverlay implements Component {
	constructor(
		private readonly theme: Theme,
		private readonly getTaskPlan: () => TaskPlan,
	) {}

	render(width: number): string[] {
		const taskPlan = this.getTaskPlan();
		const innerWidth = Math.max(4, width - 2);
		const contentWidth = Math.max(1, innerWidth - 2);
		const lines: string[] = [];
		const border = (value: string) => this.theme.fg("border", value);
		const pad = (value: string) => {
			const clipped = truncateToWidth(value, contentWidth, "...", true);
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

		addField("Objective", taskPlan.objective);
		addField(
			"Plan",
			taskPlan.plan.map((step) => {
				const marker = step.status === "done" ? "✓" : step.status === "current" ? "→" : "·";
				return `${marker} ${step.text}`;
			}),
		);
		addField("Constraints", taskPlan.constraints);
		addField("Findings", taskPlan.findings);
		if (taskPlan.plan.every((step) => step.status === "done")) line(this.theme.fg("success", "Completed"));
		line();
		line(this.theme.fg("dim", "Alt+T / /task-plan to hide"));
		lines.push(border(`╰${"─".repeat(innerWidth)}╯`));
		return lines;
	}

	invalidate(): void {}
}
