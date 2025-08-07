import * as vscode from 'vscode';
import { findGitRoot, execGitCommand } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handleCleanIgnored(): Promise<void> {
	try {
		logInfo('Git clean ignored files command triggered');
		
		const gitRoot = await findGitRoot();
		outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);

		outputChannel.appendLine('Step 1: Previewing ignored files to be deleted...');
		
		const previewResult = await execGitCommand('git clean -ndX', gitRoot);
		
		const filesToDelete = previewResult.stdout.trim();
		outputChannel.appendLine(`Preview output: ${filesToDelete || '(no ignored files found)'}`);
		
		if (!filesToDelete) {
			outputChannel.appendLine('No ignored files found to clean.');
			vscode.window.showInformationMessage(
				'✅ No ignored files found to clean.',
				'Show Output'
			).then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
			return;
		}

		const fileList = filesToDelete
			.split('\n')
			.filter(line => line.startsWith('Would remove '))
			.map(line => line.replace('Would remove ', '').trim())
			.filter(file => file);

		const fileCount = fileList.length;
		const previewText = fileList.length <= 10 
			? fileList.join('\n') 
			: fileList.slice(0, 10).join('\n') + `\n... and ${fileList.length - 10} more files`;

		const confirmation = await vscode.window.showWarningMessage(
			`Found ${fileCount} ignored file${fileCount > 1 ? 's' : ''} to delete:\n\n${previewText}\n\nThis will permanently delete all files listed in .gitignore. This action cannot be undone.`,
			{ modal: true },
			'Delete Files',
			'Show All Files',
			'Cancel'
		);

		if (confirmation === 'Show All Files') {
			const shouldDelete = await showAllFilesAndConfirm(fileList, fileCount);
			if (!shouldDelete) return;
		} else if (confirmation !== 'Delete Files') {
			outputChannel.appendLine('User cancelled deletion.');
			return;
		}

		await performCleanIgnored(gitRoot);

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logError('Git clean ignored files failed', error);
		vscode.window.showErrorMessage(`Git clean ignored files failed: ${errorMsg}`, 'Show Output').then(selection => {
			if (selection === 'Show Output') {
				outputChannel.show();
			}
		});
	}
}

async function showAllFilesAndConfirm(fileList: string[], fileCount: number): Promise<boolean> {
	outputChannel.appendLine('--- Files to be deleted ---');
	fileList.forEach(file => outputChannel.appendLine(`  ${file}`));
	outputChannel.show();
	
	const secondConfirmation = await vscode.window.showWarningMessage(
		`Delete all ${fileCount} ignored files? This action cannot be undone.`,
		{ modal: true },
		'Delete Files',
		'Cancel'
	);
	
	if (secondConfirmation !== 'Delete Files') {
		outputChannel.appendLine('User cancelled deletion after viewing files.');
		return false;
	}
	
	return true;
}

async function performCleanIgnored(gitRoot: string): Promise<void> {
	outputChannel.appendLine('Step 2: Deleting ignored files...');
	
	const deleteResult = await execGitCommand('git clean -fdX', gitRoot);

	outputChannel.appendLine(`Delete output: ${deleteResult.stdout || '(no output)'}`);
	if (deleteResult.stderr) {
		outputChannel.appendLine(`Delete stderr: ${deleteResult.stderr}`);
	}

	const deletedFiles = deleteResult.stdout.trim();
	const actualDeletedList = deletedFiles
		.split('\n')
		.filter(line => line.startsWith('Removing '))
		.map(line => line.replace('Removing ', '').trim())
		.filter(file => file);

	const actualCount = actualDeletedList.length;
	
	outputChannel.appendLine(`Successfully deleted ${actualCount} ignored file${actualCount > 1 ? 's' : ''}`);
	actualDeletedList.forEach(file => outputChannel.appendLine(`  Deleted: ${file}`));

	vscode.window.showInformationMessage(
		`✅ Deleted ${actualCount} ignored file${actualCount > 1 ? 's' : ''} from .gitignore`,
		'Show Output'
	).then(selection => {
		if (selection === 'Show Output') {
			outputChannel.show();
		}
	});
}