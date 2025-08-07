import * as vscode from 'vscode';
import { findGitRoot, execGitCommand } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handlePruneRemotes(): Promise<void> {
	try {
		logInfo('Git prune remotes command triggered');
		
		const gitRoot = await findGitRoot();
		outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);

		outputChannel.appendLine('Starting Git prune remotes process...');
		
		// Step 1: Fetch origin with prune
		outputChannel.appendLine('Step 1: Fetching origin with prune...');
		const fetchResult = await execGitCommand('git fetch origin --prune', gitRoot);
		outputChannel.appendLine(`Fetch output: ${fetchResult.stdout || '(no output)'}`);
		if (fetchResult.stderr) {
			outputChannel.appendLine(`Fetch stderr: ${fetchResult.stderr}`);
		}

		// Step 2: Get all local branches except current
		outputChannel.appendLine('Step 2: Finding local branches without remotes...');
		const currentBranchResult = await execGitCommand('git branch --show-current', gitRoot);
		const currentBranch = currentBranchResult.stdout.trim();
		
		const localBranchesResult = await execGitCommand('git branch', gitRoot);
		const localBranches = localBranchesResult.stdout
			.split('\n')
			.map(line => line.replace(/^\*?\s+/, '').trim())
			.filter(branch => branch && branch !== currentBranch);

		outputChannel.appendLine(`Found local branches (excluding current): ${localBranches.join(', ')}`);

		if (localBranches.length === 0) {
			outputChannel.appendLine('No local branches found to check. Prune complete.');
			vscode.window.showInformationMessage(
				'✅ Git prune complete! No local branches found to check.',
				'Show Output'
			).then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
			return;
		}

		// Step 3: Check which branches can be safely deleted
		const deletableBranches: string[] = [];
		const protectedBranches: string[] = [];

		for (const branch of localBranches) {
			try {
				const mergeResult = await execGitCommand(`git branch -d "${branch}"`, gitRoot);
				outputChannel.appendLine(`Branch ${branch} can be safely deleted (already merged)`);
				deletableBranches.push(branch);
			} catch (error) {
				outputChannel.appendLine(`Branch ${branch} cannot be safely deleted (not fully merged or has uncommitted changes)`);
				protectedBranches.push(branch);
			}
		}

		outputChannel.appendLine(`Deletable branches: ${deletableBranches.length > 0 ? deletableBranches.join(', ') : 'none'}`);
		outputChannel.appendLine(`Protected branches: ${protectedBranches.length > 0 ? protectedBranches.join(', ') : 'none'}`);

		if (deletableBranches.length === 0) {
			let message = '✅ Git prune complete! Remote references pruned.';
			if (protectedBranches.length > 0) {
				message += ` Found ${protectedBranches.length} local branch${protectedBranches.length > 1 ? 'es' : ''} that cannot be safely deleted.`;
			}
			
			vscode.window.showInformationMessage(message, 'Show Output').then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
			return;
		}

		// Step 4: Confirm deletion of safe branches
		let message = `Git prune found ${deletableBranches.length} local branch${deletableBranches.length > 1 ? 'es' : ''} that can be safely deleted: ${deletableBranches.join(', ')}`;
		if (protectedBranches.length > 0) {
			message += `\n\n${protectedBranches.length} branch${protectedBranches.length > 1 ? 'es' : ''} will be kept (not fully merged): ${protectedBranches.join(', ')}`;
		}
		message += '\n\nDelete the safe branches?';

		const confirmation = await vscode.window.showWarningMessage(
			message,
			{ modal: true },
			'Delete Safe Branches',
			'Skip Deletion'
		);

		if (confirmation === 'Delete Safe Branches') {
			await deleteSafeBranches(gitRoot, deletableBranches, protectedBranches.length);
		} else {
			outputChannel.appendLine('User chose to skip branch deletion. Prune complete.');
			vscode.window.showInformationMessage(
				'✅ Git prune complete! Remote pruning done, branch deletion skipped.',
				'Show Output'
			).then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
		}

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logError('Git prune remotes failed', error);
		vscode.window.showErrorMessage(`Git prune remotes failed: ${errorMsg}`, 'Show Output').then(selection => {
			if (selection === 'Show Output') {
				outputChannel.show();
			}
		});
	}
}

async function deleteSafeBranches(gitRoot: string, branches: string[], protectedCount: number): Promise<void> {
	outputChannel.appendLine('Step 3: Deleting safe local branches...');
	
	let deletedCount = 0;
	const failedDeletions: string[] = [];

	for (const branch of branches) {
		try {
			const deleteResult = await execGitCommand(`git branch -d "${branch}"`, gitRoot);
			outputChannel.appendLine(`Deleted branch: ${branch}`);
			if (deleteResult.stdout) {
				outputChannel.appendLine(`Delete output: ${deleteResult.stdout.trim()}`);
			}
			deletedCount++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			outputChannel.appendLine(`Failed to delete branch ${branch}: ${errorMsg}`);
			failedDeletions.push(branch);
		}
	}

	let message = '';
	if (failedDeletions.length === 0) {
		message = `✅ Git prune complete! Deleted ${deletedCount} local branch${deletedCount > 1 ? 'es' : ''}.`;
		if (protectedCount > 0) {
			message += ` Kept ${protectedCount} protected branch${protectedCount > 1 ? 'es' : ''}.`;
		}
	} else {
		message = `⚠️ Git prune partially complete. Deleted ${deletedCount}/${branches.length} branches. Failed: ${failedDeletions.join(', ')}`;
		if (protectedCount > 0) {
			message += `. Kept ${protectedCount} protected branch${protectedCount > 1 ? 'es' : ''}.`;
		}
	}

	vscode.window.showInformationMessage(message, 'Show Output').then(selection => {
		if (selection === 'Show Output') {
			outputChannel.show();
		}
	});
}