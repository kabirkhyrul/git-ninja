import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { extractUriContext } from '../utils/uri';
import { getBranches, execGitCommand } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handleCheckoutFromBranch(uri: vscode.Uri | any): Promise<void> {
	try {
		logInfo('Checkout file from branch command triggered');
		
		const context = await extractUriContext(uri);
		outputChannel.appendLine(`Processing file: ${context.filePath}`);
		
		if (!context.filePath) {
			throw new Error('Could not determine file path from selection');
		}

		// Get available branches
		const branches = await getBranches(context.gitRoot);
		
		if (branches.length === 0) {
			throw new Error('No branches found in this repository');
		}

		// Show branch selection UI
		const selectedBranch = await vscode.window.showQuickPick(branches, {
			placeHolder: `Select branch to checkout ${path.basename(context.filePath)} from`,
			title: `Checkout ${path.basename(context.filePath)} from Branch`,
			ignoreFocusOut: true
		});

		if (!selectedBranch) {
			outputChannel.appendLine(`User cancelled branch selection`);
			return;
		}

		outputChannel.appendLine(`Selected branch: ${selectedBranch}`);

		// Check if file exists in the selected branch
		try {
			await execGitCommand(`git cat-file -e ${selectedBranch}:"${context.relativePath}"`, context.gitRoot);
		} catch (error) {
			throw new Error(`File "${context.relativePath}" does not exist in branch "${selectedBranch}"`);
		}

		// Confirm the checkout action
		const confirmation = await vscode.window.showWarningMessage(
			`This will replace "${path.basename(context.filePath)}" with the version from branch "${selectedBranch}". Any local changes will be lost.`,
			{ modal: true },
			'Checkout File',
			'Cancel'
		);

		if (confirmation !== 'Checkout File') {
			outputChannel.appendLine(`User cancelled checkout confirmation`);
			return;
		}

		// Perform the checkout
		const command = `git checkout ${selectedBranch} -- "${context.relativePath}"`;
		outputChannel.appendLine(`Executing: ${command}`);

		const result = await execGitCommand(command, context.gitRoot);

		outputChannel.appendLine(`Git command output: ${result.stdout || '(no output)'}`);
		if (result.stderr) {
			outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
		}

		// Verify the file was updated
		if (fs.existsSync(context.filePath)) {
			outputChannel.appendLine(`Successfully checked out ${context.relativePath} from branch ${selectedBranch}`);
			vscode.window.showInformationMessage(
				`✅ ${path.basename(context.filePath)} updated from branch "${selectedBranch}"`,
				'Show File',
				'Show Output'
			).then(selection => {
				if (selection === 'Show File') {
					vscode.window.showTextDocument(context.actualUri);
				} else if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
		} else {
			throw new Error('File checkout completed but file not found on disk');
		}
		
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logError('Git checkout failed', error);
		vscode.window.showErrorMessage(`Git checkout failed: ${errorMsg}`, 'Show Output').then(selection => {
			if (selection === 'Show Output') {
				outputChannel.show();
			}
		});
	}
}