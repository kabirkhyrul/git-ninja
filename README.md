# Git Ninja

**Silent. Powerful. Expert Git tools at your fingertips.**

Git Ninja provides advanced Git file management tools directly in VS Code's context menus. Perfect for developers who need precise control over their Git workflow without leaving their editor.

## Features

### **Toggle .git/info/exclude**
Permanently ignore files locally without affecting `.gitignore` or other team members.
- **Perfect for:** Personal config files, IDE settings, local notes
- **Toggles:** Add/remove files from `.git/info/exclude`

### **Skip-Worktree (Recommended)**
Ignore local changes to tracked files while keeping them in the repository.
- **Perfect for:** Configuration files you need to modify locally but don't want to commit
- **Use cases:** `package.json`, `webpack.config.js`, database configs, API endpoints
- **Benefits:** More reliable than assume-unchanged, designed for this exact purpose

### **Checkout File from Branch**
Pull specific files from other branches into your current working directory.
- **Interactive branch selection:** Choose from all available local and remote branches
- **Safety first:** Confirms before overwriting with clear warnings
- **Smart validation:** Checks if file exists in target branch before proceeding

## Quick Start

1. **Install** Git Ninja from the VS Code Marketplace
2. **Right-click** any file in Explorer or Source Control
3. **Choose** your Git Ninja command from the context menu
4. **Follow** the interactive prompts

## Commands

| Command | Description | Best For |
|---------|-------------|----------|
| **Git: Toggle .git/info/exclude** | Add/remove files from local exclude list | Personal files you never want to track |
| **Git: Toggle Skip-Worktree** | Ignore local changes to tracked files | Config files you modify locally |
| **Git: Checkout File from Branch** | Replace file with version from another branch | Syncing specific files across branches |

## Usage Examples

### Skip-Worktree for Config Files
```bash
# Before: Your package.json changes always show up in git status
# After: Modify locally, changes are ignored by Git

# Example workflow:
1. Right-click package.json → "Git: Toggle Skip-Worktree"
2. Modify your package.json for local development
3. Git status won't show package.json as modified
4. Your changes stay local, commits stay clean
```

### Checkout Specific Files
```bash
# Before: git checkout main -- webpack.config.js
# After: Right-click → "Git: Checkout File from Branch" → Select "main"

# Benefits:
- Visual branch selection
- File existence validation
- Safety confirmations
- Automatic staging
```

### Local File Exclusion
```bash
# Before: Adding files to .gitignore affects everyone
# After: Local exclusion affects only you

# Perfect for:
- .vscode/settings.json (personal VS Code settings)
- notes.md (your personal project notes)
- debug.log (temporary debugging files)
```

## Requirements

- **VS Code** 1.102.0 or higher
- **Git** installed and accessible from command line
- **Git repository** (commands only work within Git repositories)

## How It Works

Git Ninja leverages Git's built-in features:

- **`.git/info/exclude`** - Git's local exclude file (like .gitignore but personal)
- **`skip-worktree`** - Git flag to ignore changes to tracked files
- **`git checkout <branch> -- <file>`** - Git's file checkout command

All operations are performed using standard Git commands, ensuring compatibility and reliability.

## Contributing

Found a bug? Have a feature request? 

1. **Issues:** [Report bugs or request features](https://github.com/your-username/git-ninja/issues)
2. **Pull Requests:** Contributions welcome!
3. **Feedback:** Help us improve Git Ninja

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Built with love for the VS Code community.

---

**If Git Ninja helps your workflow, please star the repository and leave a review!**
