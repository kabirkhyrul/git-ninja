import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findGitRoot } from '../utils/git';
import { outputChannel } from '../utils/logger';

const execAsync = promisify(exec);

export async function handleCleanUntrackedIgnored(): Promise<void> {
	try {
		const gitRoot = await findGitRoot();
		if (!gitRoot) {
			vscode.window.showErrorMessage('Not in a git repository.');
			return;
		}

		const result = await vscode.window.showWarningMessage(
			'This will permanently delete all untracked and ignored files. This action cannot be undone.',
			{ modal: true },
			'Continue',
			'Cancel'
		);

		if (result !== 'Continue') {
			return;
		}

		outputChannel.show();
		outputChannel.appendLine('Cleaning untracked and ignored files...');

		const { stdout, stderr } = await execAsync('git clean -Xfd', { cwd: gitRoot });

		if (stderr) {
			outputChannel.appendLine(`Warning: ${stderr}`);
		}

		if (stdout.trim()) {
			outputChannel.appendLine(`Removed files:\n${stdout}`);
			vscode.window.showInformationMessage('Successfully cleaned untracked and ignored files.');
		} else {
			outputChannel.appendLine('No untracked or ignored files to remove.');
			vscode.window.showInformationMessage('No untracked or ignored files found to clean.');
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`Error cleaning untracked and ignored files: ${errorMessage}`);
		vscode.window.showErrorMessage(`Failed to clean untracked and ignored files: ${errorMessage}`);
	}
}