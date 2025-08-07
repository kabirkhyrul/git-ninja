import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { extractUriContext } from '../utils/uri';
import { getSkipWorktreeStatus, execGitCommand } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handleSkipWorktreeToggle(uri: vscode.Uri | any): Promise<void> {
	try {
		logInfo('Toggle skip-worktree command triggered');
		
		const context = await extractUriContext(uri);
		outputChannel.appendLine(`Processing file: ${context.filePath}`);
		
		if (!context.filePath) {
			throw new Error('Could not determine file path from selection');
		}

		if (!fs.existsSync(context.filePath)) {
			throw new Error(`File does not exist: ${context.filePath}`);
		}

		const status = await getSkipWorktreeStatus(context.gitRoot, context.relativePath);
		outputChannel.appendLine(`File status - tracked: ${status.tracked}, skipWorktree: ${status.skipWorktree}`);
		
		if (!status.tracked) {
			const errorMsg = `File "${context.relativePath}" is not tracked by Git.\n\nTo use skip-worktree, the file must first be added to Git tracking.\nUse: git add "${context.relativePath}"`;
			logError('File not tracked', errorMsg);
			vscode.window.showErrorMessage(errorMsg, 'Open Git Documentation').then(selection => {
				if (selection === 'Open Git Documentation') {
					vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/docs/git-update-index#_skip_worktree_bit'));
				}
			});
			return;
		}

		const flag = status.skipWorktree ? '--no-skip-worktree' : '--skip-worktree';
		const action = status.skipWorktree ? 'Removing' : 'Setting';
		const command = `git update-index ${flag} -- "${context.relativePath}"`;
		
		outputChannel.appendLine(`${action} skip-worktree flag...`);
		outputChannel.appendLine(`Executing: ${command}`);

		// Toggle flag
		const result = await execGitCommand(command, context.gitRoot);
		
		outputChannel.appendLine(`Git command output: ${result.stdout || '(no output)'}`);
		if (result.stderr) {
			outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
		}

		// Wait a moment for the git index to update
		await new Promise(resolve => setTimeout(resolve, 100));

		// Verify the change worked
		await verifySkipWorktreeChange(context.gitRoot, context.relativePath, context.filePath, status.skipWorktree);
		
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorCode = (error as any)?.code;
		const stderr = (error as any)?.stderr;
		
		logError('Git skip-worktree failed', error);
		
		let userMessage = `Git skip-worktree failed: ${errorMsg}`;
		if (stderr && typeof stderr === 'string') {
			userMessage += `\n\nGit error: ${stderr.trim()}`;
		}
		
		vscode.window.showErrorMessage(userMessage, 'Show Output').then(selection => {
			if (selection === 'Show Output') {
				outputChannel.show();
			}
		});
	}
}

async function verifySkipWorktreeChange(gitRoot: string, relativePath: string, filePath: string, oldStatus: boolean): Promise<void> {
	const rawCheck = await execGitCommand(`git ls-files -v -- "${relativePath}"`, gitRoot);
	outputChannel.appendLine(`Raw git ls-files output: "${rawCheck.stdout.trim()}"`);
	
	const newStatus = await getSkipWorktreeStatus(gitRoot, relativePath);
	const expectedState = !oldStatus;
	
	outputChannel.appendLine(`Verification - Expected: ${expectedState}, Got: ${newStatus.skipWorktree}`);
	
	if (newStatus.skipWorktree !== expectedState) {
		// Try one more time with a longer delay
		outputChannel.appendLine(`First verification failed, waiting longer and retrying...`);
		await new Promise(resolve => setTimeout(resolve, 500));
		
		const retryRawCheck = await execGitCommand(`git ls-files -v -- "${relativePath}"`, gitRoot);
		outputChannel.appendLine(`Retry raw git ls-files output: "${retryRawCheck.stdout.trim()}"`);
		
		const retryStatus = await getSkipWorktreeStatus(gitRoot, relativePath);
		outputChannel.appendLine(`Retry verification - Expected: ${expectedState}, Got: ${retryStatus.skipWorktree}`);
		
		if (retryStatus.skipWorktree !== expectedState) {
			outputChannel.appendLine(`Git command may have succeeded but verification failed. This could be a timing issue.`);
			vscode.window.showWarningMessage(`Command executed but status verification failed. Check Git Ninja output for details.`, 'Show Output').then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
			return;
		} else {
			// Retry worked, update newStatus
			newStatus.skipWorktree = retryStatus.skipWorktree;
		}
	}

	const statusText = newStatus.skipWorktree ? 'skip-worktree (Git will ignore local changes)' : 'normal tracking (Git will detect changes)';
	const shortStatus = newStatus.skipWorktree ? 'ignoring local changes' : 'tracking changes';
	
	outputChannel.appendLine(`Successfully set ${relativePath} to: ${statusText}`);
	vscode.window.showInformationMessage(`${path.basename(filePath)} is now ${shortStatus}`, 'Show Details').then(selection => {
		if (selection === 'Show Details') {
			outputChannel.show();
		}
	});
}