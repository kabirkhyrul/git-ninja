import * as vscode from 'vscode';
import { 
	handleExclude, 
	handleSkipWorktreeToggle, 
	handleCheckoutFromBranch, 
	handleCleanup, 
	handleCleanIgnored,
	handlePruneRemotes,
	handleCleanUntrackedIgnored
} from './commands';
import { outputChannel } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
	const toggleExclude = vscode.commands.registerCommand('git-exclude.toggle-exclude', async (uri: vscode.Uri | any) => {
		await handleExclude(uri);
	});

	const toggleSkipWorktree = vscode.commands.registerCommand('git-exclude.toggle-skip-worktree', async (uri: vscode.Uri | any) => {
		await handleSkipWorktreeToggle(uri);
	});

	const cleanup = vscode.commands.registerCommand('git-exclude.cleanup', async () => {
		await handleCleanup();
	});

	const cleanIgnored = vscode.commands.registerCommand('git-exclude.clean-ignored', async () => {
		await handleCleanIgnored();
	});

	const checkoutFromBranch = vscode.commands.registerCommand('git-exclude.checkout-from-branch', async (uri: vscode.Uri | any) => {
		await handleCheckoutFromBranch(uri);
	});

	const pruneRemotes = vscode.commands.registerCommand('git-exclude.prune-remotes', async () => {
		await handlePruneRemotes();
	});

	const cleanUntrackedIgnored = vscode.commands.registerCommand('git-exclude.clean-untracked-ignored', async () => {
		await handleCleanUntrackedIgnored();
	});

	context.subscriptions.push(toggleExclude, toggleSkipWorktree, cleanup, cleanIgnored, checkoutFromBranch, pruneRemotes, cleanUntrackedIgnored, outputChannel);
}

export function deactivate() {}