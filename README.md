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

## Install from Git

This repository is private. Install it over HTTPS after authenticating to GitHub:

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

The extension imports Pi core packages and `typebox`; Pi supplies those packages when the extension is loaded.

## Security

Pi extensions execute TypeScript with the same system permissions as Pi. Review the source before installing this package.
