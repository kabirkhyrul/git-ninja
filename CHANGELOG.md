# Change Log

All notable changes to the "git-ninja" extension will be documented in this file.

## [1.1.0] - 2025-07-31

### Added
- **Git Cleanup**: Prune remote references and delete orphaned local branches
  - Interactive branch deletion with confirmation
  - Safe preview of branches to be deleted
  - Detailed progress reporting
- **Clean Ignored Files**: Remove all files listed in .gitignore
  - Safe preview mode (`git clean -ndX`)
  - Interactive file list display
  - Permanent deletion with double confirmation

### Improved
- **Enhanced Git Repository Detection**
  - VS Code Git extension API integration for better compatibility
  - Multi-root workspace support
  - Improved handling of Git worktrees and non-standard setups
  - Better error messages for repository detection issues

- **Production-Quality Git Operations**
  - Safer path handling with `--` separators in Git commands
  - Improved branch listing using `git for-each-ref` (eliminates duplicates and symbolic refs)
  - More accurate skip-worktree detection using proper Git status tags
  - Better file vs directory detection for repository root finding

- **Code Architecture**
  - Complete modular refactor for better maintainability
  - Separated commands into dedicated modules
  - Centralized utilities for Git operations, logging, and URI handling
  - Improved TypeScript types and interfaces
  - Better error handling patterns across all commands

### Fixed
- Repository detection in mono-repos where workspace folder is the Git root
- Skip-worktree status detection now uses correct `S` tag instead of case-insensitive matching
- More reliable branch detection that handles remote tracking properly
- Better error handling for edge cases in Git operations

### Technical
- Modular architecture with separated concerns
- Enhanced logging with structured output
- Production-ready Git command execution
- Improved TypeScript coverage and type safety
- Better VS Code API integration

## [1.0.1] - 2025-07-30

### Fixed
- Removed invalid icon reference that was causing package validation issues

## [1.0.0] - 2025-07-30

### Added
- **Toggle .git/info/exclude**: Add/remove files from local Git exclude list
- **Toggle Skip-Worktree**: Ignore local changes to tracked files (recommended for config files)
- **Checkout File from Branch**: Interactive file checkout from any branch with safety confirmations
- Context menu integration for both Explorer and Source Control views
- Comprehensive error handling and user feedback
- Detailed logging via Git Ninja output channel
- Support for both local and remote branch selection
- File existence validation before checkout operations
- Interactive branch selection with search functionality

### Features
- Works with any Git repository
- No configuration required
- Uses standard Git commands for reliability
- Smart URI handling for different VS Code contexts
- Confirmation dialogs for destructive operations
- Links to Git documentation for learning

### Technical
- Built with TypeScript and esbuild
- Minimal dependencies
- Optimized bundle size
- Comprehensive error handling
- Cross-platform compatibility