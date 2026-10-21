# Pi Task Plan

A Pi extension that maintains a concise task plan for the current session.

It provides:

- the `task_plan` tool for the agent;
- `/task-plan` to toggle the overlay;
- `/task-plan show` and `/task-plan hide` to control visibility;
- `/task-plan reset` to clear the current session's plan;
- `Alt+T` to toggle the overlay;
- session-persisted task-plan state.

## Terminal display

If the Task Plan overlay flickers in the terminal, open `/settings` and set the TUI mode to `fullscreen`.

## OMP (Oh My Pi) port

`extensions/task-plan-omp/` is a port of the same extension for OMP using the `@oh-my-pi/*` package family. It provides the same tool, commands, `Alt+T` shortcut, overlay, and session-persisted state; its overlay delegates focus to the active editor slot, so temporary selectors such as `/tree` remain interactive, and returns focus to the composer when the overlay regains focus.

Run it without installing:

```bash
omp --extension /path/to/task-plan/extensions/task-plan-omp/index.ts
```

The `omp` manifest field in `package.json` registers it for package-based loading. The OMP port keeps the working plan session-local; it does not read or write durable plan records.

## Install from Git

This repository is public and can be installed over HTTPS without GitHub authentication:

```bash
pi install git:github.com/onmete/task-plan
```

Use a tag or commit for a reproducible installation:

```bash
pi install git:github.com/onmete/task-plan@v0.1.0
```

For SSH:

```bash
pi install git:git@github.com:onmete/task-plan@v0.1.0
```

## Install for a project

To make the package part of a project's shared Pi configuration:

```bash
pi install -l git:github.com/onmete/task-plan@v0.1.0
```

This writes the package to `.pi/settings.json`. Commit that file so other contributors receive the same package configuration.

## Publish to npm

The package contains the `pi-package` keyword used for Pi package discovery. Before publishing, choose an available npm package name and add repository metadata if desired:

```bash
npm login
npm publish --access public
```

Then users can install it with:

```bash
pi install npm:pi-task-plan@0.1.0
```

## Development

Run the state tests with:

```bash
npm test
```

`npm test` runs both suites: the Pi port tests (Node) and the OMP port tests (`bun test test/state-omp.test.ts test/overlay-omp.test.ts`). The OMP port type-checks against the `@oh-my-pi/*` packages pinned in `dependencies`.

The Pi extension imports Pi core packages and `typebox`; Pi supplies those packages when the extension is loaded.

## Security

Pi extensions execute TypeScript with the same system permissions as Pi. Review the source before installing this package.
