# Pi Task Plan

A Pi extension that maintains a concise task plan for the current session.

It provides:

- the `task_plan` tool for the agent;
- `/task-plan` to toggle the overlay;
- `/task-plan show` and `/task-plan hide` to control visibility;
- `/task-plan reset` to clear the current session's plan;
- `Alt+T` to toggle the overlay;
- session-persisted task-plan state.

## Install from Git

```bash
pi install git:github.com/YOUR-ORG/pi-task-plan
```

Use a tag or commit for a reproducible installation:

```bash
pi install git:github.com/YOUR-ORG/pi-task-plan@v0.1.0
```

For a private GitHub repository over SSH:

```bash
pi install git:git@github.com:YOUR-ORG/pi-task-plan@v0.1.0
```

Replace `YOUR-ORG` with the actual GitHub organization or user.

## Install for a project

To make the package part of a project's shared Pi configuration:

```bash
pi install -l git:github.com/YOUR-ORG/pi-task-plan@v0.1.0
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

## Optional agent instructions

`INSTRUCTIONS_APPEND.md` contains the global Pi agent instructions used while developing this extension. It is provided as a reference for the person installing the package; it is not applied automatically.

Review it first, then manually copy the relevant content to the desired `AGENTS.md` location. To append the complete file to the global Pi instructions:

```bash
cat INSTRUCTIONS_APPEND.md >> ~/.pi/agent/AGENTS.md
```

Do not append it if those instructions are already present, or if you want the instructions to apply only to a particular project.

## Development

Run the state tests with:

```bash
npm test
```

The extension imports Pi core packages and `typebox`; Pi supplies those packages when the extension is loaded.

## Security

Pi extensions execute TypeScript with the same system permissions as Pi. Review the source before installing this package.
