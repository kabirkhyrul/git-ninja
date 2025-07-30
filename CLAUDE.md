# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git Ninja is a VS Code extension that provides advanced Git management tools focused on file exclusion and assume-unchanged functionality. The extension adds context menu commands to exclude files from Git tracking without using .gitignore.

## Build and Development Commands

- **Build for production**: `npm run build` - Uses esbuild to bundle the extension
- **Development watch mode**: `npm run watch` - Builds and watches for changes
- **Type checking**: `npm run type-check` - Runs TypeScript compiler without emitting files
- **Prepare for publishing**: `npm run vscode:prepublish` - Builds the extension for publication

## Architecture

### Core Extension Structure
- **Entry point**: `src/extension.ts` - Contains the main extension activation logic
- **Build output**: `dist/extension.js` - Bundled extension file created by esbuild
- **Commands implemented**:
  - `git-exclude.add` - Adds files to `.git/info/exclude`
  - `git-exclude.toggle` - Toggles Git's assume-unchanged flag

### Key Functions
- `getGitRoot()` - Finds the Git repository root using `git rev-parse --show-toplevel`
- `handleExclude()` - Manages adding files to `.git/info/exclude`
- `getTrackedStatus()` - Checks if files are tracked and their assume-unchanged status
- `handleToggle()` - Toggles the assume-unchanged flag on tracked files

### Build System
The project uses esbuild for bundling with a custom configuration in `esbuild.js`. The build system:
- Bundles TypeScript source into CommonJS format
- Excludes the 'vscode' module as external dependency
- Includes production/development mode support
- Has watch mode with problem matcher integration

### Testing
- Test configuration in `.vscode-test.mjs` using `@vscode/test-cli`
- Tests build to `out/test/` directory
- No existing test files found in current codebase

## Development Notes

The extension uses Node.js child_process to execute Git commands and file system operations to manage Git's exclude file. All Git operations are relative to the detected repository root.