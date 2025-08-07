import * as vscode from 'vscode';
import { findGitRoot, execGitCommand } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handleCleanup(): Promise<void> {
	try {
		logInfo('Git cleanup command triggered');
		
		const gitRoot = await findGitRoot();
		outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);

		outputChannel.appendLine('Starting Git cleanup process...');
		
		// Step 1: Prune remote references
		outputChannel.appendLine('Step 1: Pruning remote references...');
		const pruneResult = await execGitCommand('git remote prune origin', gitRoot);
		outputChannel.appendLine(`Prune output: ${pruneResult.stdout || '(no output)'}`);
		if (pruneResult.stderr) {
			outputChannel.appendLine(`Prune stderr: ${pruneResult.stderr}`);
		}

		// Step 2: Find orphaned local branches
		outputChannel.appendLine('Step 2: Finding orphaned local branches...');
		const branchResult = await execGitCommand('git branch -vv', gitRoot);
		
		const orphanedBranches = branchResult.stdout
			.split('\n')
			.filter(line => line.includes(': gone]'))
			.filter(line => !line.trim().startsWith('*'))
			.map(line => line.trim().split(/\s+/)[0])
			.filter(branch => branch && branch !== '*');

		outputChannel.appendLine(`Found orphaned branches: ${orphanedBranches.length > 0 ? orphanedBranches.join(', ') : 'none'}`);

		if (orphanedBranches.length === 0) {
			outputChannel.appendLine('No orphaned branches found. Cleanup complete.');
			vscode.window.showInformationMessage(
				'✅ Git cleanup complete! No orphaned branches found.',
				'Show Output'
			).then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
			return;
		}

		// Step 3: Confirm and delete orphaned branches
		const confirmation = await vscode.window.showWarningMessage(
			`Found ${orphanedBranches.length} orphaned local branch${orphanedBranches.length > 1 ? 'es' : ''}: ${orphanedBranches.join(', ')}\n\nDelete ${orphanedBranches.length > 1 ? 'these branches' : 'this branch'}? This action cannot be undone.`,
			{ modal: true },
			'Delete Branches',
			'Skip Deletion'
		);

		if (confirmation === 'Delete Branches') {
			await deleteOrphanedBranches(gitRoot, orphanedBranches);
		} else {
			outputChannel.appendLine('User chose to skip branch deletion. Cleanup complete.');
			vscode.window.showInformationMessage(
				'✅ Git cleanup complete! Remote pruning done, branch deletion skipped.',
				'Show Output'
			).then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
		}

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logError('Git cleanup failed', error);
		vscode.window.showErrorMessage(`Git cleanup failed: ${errorMsg}`, 'Show Output').then(selection => {
			if (selection === 'Show Output') {
				outputChannel.show();
			}
		});
	}
}

async function deleteOrphanedBranches(gitRoot: string, branches: string[]): Promise<void> {
	outputChannel.appendLine('Step 3: Deleting orphaned branches...');
	
	let deletedCount = 0;
	const failedDeletions: string[] = [];

	for (const branch of branches) {
		try {
			const deleteResult = await execGitCommand(`git branch -D "${branch}"`, gitRoot);
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

	const message = failedDeletions.length === 0 
		? `✅ Git cleanup complete! Deleted ${deletedCount} orphaned branch${deletedCount > 1 ? 'es' : ''}.`
		: `⚠️ Git cleanup partially complete. Deleted ${deletedCount}/${branches.length} branches. Failed: ${failedDeletions.join(', ')}`;

	vscode.window.showInformationMessage(message, 'Show Output').then(selection => {
		if (selection === 'Show Output') {
			outputChannel.show();
		}
	});
}