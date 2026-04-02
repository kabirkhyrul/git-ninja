# Git Ninja

**Silent. Powerful. Expert Git tools at your fingertips.**

Git Ninja provides advanced Git file management tools directly in VS Code's context menus. Perfect for developers who need precise control over their Git workflow without leaving their editor.

## Features

- Generate a commit message from modified tracked files.
- Target the selected SCM repository or all open repositories.
- Write the generated message to the SCM input box and copy it to the clipboard.
- Toggle `.git/info/exclude` for a file from the editor or explorer context menu.
- Replace a file with the version from another branch.

## Requirements

- VS Code
- Git available in `PATH`
- Ollama available at the configured API URL

## Settings

- `gitNinja.apiUrl`
- `gitNinja.model`
- `gitNinja.systemPrompt`
- `gitNinja.diffMaxChars`
- `gitNinja.debug`
- `gitNinja.applyToAllRepositories`

## Notes

- Commit generation uses modified tracked files only.
- Newly created files are skipped.
- If no supported changes exist, no commit message is generated.

## Usage

Run `Git Ninja: Generate Commit Message` from the Command Palette.

From the Source Control title bar, the command runs for the selected repository.

From the editor or Explorer context menu, you can use:

- `Git Ninja: Toggle Exclude File`
- `Git Ninja: Checkout File From Branch`
