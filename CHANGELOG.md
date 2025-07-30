# Change Log

All notable changes to the "git-ninja" extension will be documented in this file.

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