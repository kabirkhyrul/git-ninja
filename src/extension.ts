import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const outputChannel = vscode.window.createOutputChannel('Git Ninja');

export function activate(context: vscode.ExtensionContext) {
	const toggleExclude = vscode.commands.registerCommand('git-exclude.toggle-exclude', async (uri: vscode.Uri | any) => {
		await handleExclude(uri);
	});

	const toggleSkipWorktree = vscode.commands.registerCommand('git-exclude.toggle-skip-worktree', async (uri: vscode.Uri | any) => {
		await handleSkipWorktreeToggle(uri);
	});

	const checkoutFromBranch = vscode.commands.registerCommand('git-exclude.checkout-from-branch', async (uri: vscode.Uri | any) => {
		try {
			outputChannel.appendLine(`[${new Date().toISOString()}] Checkout file from branch command triggered`);
			
			// Handle SCM resource state context
			let actualUri: vscode.Uri;
			if (uri?.resourceUri) {
				actualUri = uri.resourceUri;
				outputChannel.appendLine(`Using resourceUri from SCM context`);
			} else if (uri?.fsPath || uri?.scheme) {
				actualUri = uri;
				outputChannel.appendLine(`Using direct URI`);
			} else {
				throw new Error('No valid file URI provided. Please right-click on a file in Explorer or Source Control.');
			}
			
			const filePath = actualUri.fsPath;
			outputChannel.appendLine(`Processing file: ${filePath}`);
			
			if (!filePath) {
				throw new Error('Could not determine file path from selection');
			}

			const gitRoot = await getGitRoot(filePath);
			const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
			outputChannel.appendLine(`Git root: ${gitRoot}`);
			outputChannel.appendLine(`Relative path: ${relativePath}`);

			// Get available branches
			const branches = await getBranches(gitRoot);
			
			if (branches.length === 0) {
				throw new Error('No branches found in this repository');
			}

			// Show branch selection UI
			const selectedBranch = await vscode.window.showQuickPick(branches, {
				placeHolder: `Select branch to checkout ${path.basename(filePath)} from`,
				title: `Checkout ${path.basename(filePath)} from Branch`,
				ignoreFocusOut: true
			});

			if (!selectedBranch) {
				outputChannel.appendLine(`User cancelled branch selection`);
				return;
			}

			outputChannel.appendLine(`Selected branch: ${selectedBranch}`);

			// Check if file exists in the selected branch
			try {
				await execAsync(`git cat-file -e ${selectedBranch}:"${relativePath}"`, {
					cwd: gitRoot
				});
			} catch (error) {
				throw new Error(`File "${relativePath}" does not exist in branch "${selectedBranch}"`);
			}

			// Confirm the checkout action
			const confirmation = await vscode.window.showWarningMessage(
				`This will replace "${path.basename(filePath)}" with the version from branch "${selectedBranch}". Any local changes will be lost.`,
				{ modal: true },
				'Checkout File',
				'Cancel'
			);

			if (confirmation !== 'Checkout File') {
				outputChannel.appendLine(`User cancelled checkout confirmation`);
				return;
			}

			// Perform the checkout
			const command = `git checkout ${selectedBranch} -- "${relativePath}"`;
			outputChannel.appendLine(`Executing: ${command}`);

			const result = await execAsync(command, {
				cwd: gitRoot
			});

			outputChannel.appendLine(`Git command output: ${result.stdout || '(no output)'}`);
			if (result.stderr) {
				outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
			}

			// Verify the file was updated
			if (fs.existsSync(filePath)) {
				outputChannel.appendLine(`Successfully checked out ${relativePath} from branch ${selectedBranch}`);
				vscode.window.showInformationMessage(
					`✅ ${path.basename(filePath)} updated from branch "${selectedBranch}"`,
					'Show File',
					'Show Output'
				).then(selection => {
					if (selection === 'Show File') {
						vscode.window.showTextDocument(actualUri);
					} else if (selection === 'Show Output') {
						outputChannel.show();
					}
				});
			} else {
				throw new Error('File checkout completed but file not found on disk');
			}
			
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			outputChannel.appendLine(`[ERROR] ${errorMsg}`);
			vscode.window.showErrorMessage(`Git checkout failed: ${errorMsg}`, 'Show Output').then(selection => {
				if (selection === 'Show Output') {
					outputChannel.show();
				}
			});
		}
	});

	context.subscriptions.push(toggleExclude, toggleSkipWorktree, checkoutFromBranch, outputChannel);
}

export function deactivate() {}

async function isFileInExclude(filePath: string): Promise<boolean> {
	try {
		const gitRoot = await getGitRoot(filePath);
		const excludePath = path.join(gitRoot, '.git', 'info', 'exclude');
		const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
		
		if (!fs.existsSync(excludePath)) {
			return false;
		}
		
		const content = fs.readFileSync(excludePath, 'utf8');
		const lines = content.split('\n').map(line => line.trim()).filter(line => line);
		
		return lines.includes(relativePath);
	} catch (error) {
		return false;
	}
}

async function getGitRoot(filePath: string): Promise<string> {
	try {
		if (!filePath) {
			throw new Error('File path is undefined or empty');
		}
		
		const workingDir = path.dirname(filePath);
		outputChannel.appendLine(`Checking git root from directory: ${workingDir}`);
		
		const { stdout, stderr } = await execAsync('git rev-parse --show-toplevel', {
			cwd: workingDir
		});
		
		const gitRoot = stdout.trim();
		outputChannel.appendLine(`Found git root: ${gitRoot}`);
		return gitRoot;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorCode = (error as any)?.code;
		const stderr = (error as any)?.stderr;
		outputChannel.appendLine(`Git command failed: ${errorMsg}`);
		outputChannel.appendLine(`Error code: ${errorCode}`);
		outputChannel.appendLine(`Stderr: ${stderr}`);
		throw new Error(`Not a git repository or git command failed: ${errorMsg}`);
	}
}

async function handleExclude(uri: vscode.Uri | any) {
	try {
		outputChannel.appendLine(`[${new Date().toISOString()}] Command triggered`);
		outputChannel.appendLine(`URI received: ${uri ? JSON.stringify(uri, null, 2) : 'undefined'}`);
		
		if (!uri) {
			throw new Error('No file URI provided');
		}
		
		// Handle SCM resource state context
		let actualUri: vscode.Uri;
		if (uri.resourceUri) {
			actualUri = uri.resourceUri;
			outputChannel.appendLine(`Using resourceUri from SCM context`);
		} else if (uri.fsPath || uri.scheme) {
			actualUri = uri;
			outputChannel.appendLine(`Using direct URI`);
		} else {
			throw new Error('Could not extract URI from provided object');
		}
		
		const filePath = actualUri.fsPath;
		outputChannel.appendLine(`File path: ${filePath}`);
		
		if (!filePath) {
			throw new Error('Could not get file path from URI');
		}
		
		outputChannel.appendLine(`File exists: ${fs.existsSync(filePath)}`);
		outputChannel.appendLine(`Working directory: ${process.cwd()}`);
		
		const gitRoot = await getGitRoot(filePath);
		outputChannel.appendLine(`Git root: ${gitRoot}`);
		
		const gitInfoDir = path.join(gitRoot, '.git', 'info');
		const excludePath = path.join(gitInfoDir, 'exclude');
		const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
		outputChannel.appendLine(`Relative path: ${relativePath}`);

		// Ensure .git/info directory exists
		if (!fs.existsSync(gitInfoDir)) {
			fs.mkdirSync(gitInfoDir, { recursive: true });
			outputChannel.appendLine(`Created .git/info directory`);
		}

		// Ensure exclude file exists
		if (!fs.existsSync(excludePath)) {
			fs.writeFileSync(excludePath, '');
			outputChannel.appendLine(`Created exclude file`);
		}

		// Toggle entry - add if not present, remove if present
		const content = fs.readFileSync(excludePath, 'utf8');
		const lines = content.split('\n').map(line => line.trim()).filter(line => line);
		
		if (!lines.includes(relativePath)) {
			// Add entry
			const newContent = content.trim() ? `${content.trim()}\n${relativePath}\n` : `${relativePath}\n`;
			fs.writeFileSync(excludePath, newContent);
			outputChannel.appendLine(`Added entry to exclude file`);
			vscode.window.showInformationMessage(`Added to .git/info/exclude: ${relativePath}`);
		} else {
			// Remove entry
			const filteredLines = lines.filter(line => line !== relativePath);
			const newContent = filteredLines.length > 0 ? filteredLines.join('\n') + '\n' : '';
			fs.writeFileSync(excludePath, newContent);
			outputChannel.appendLine(`Removed entry from exclude file`);
			vscode.window.showInformationMessage(`Removed from .git/info/exclude: ${relativePath}`);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`[ERROR] ${errorMsg}`);
		vscode.window.showErrorMessage(`Error: ${errorMsg}`);
	}
}

async function getBranches(gitRoot: string): Promise<string[]> {
	try {
		const { stdout } = await execAsync('git branch -a', {
			cwd: gitRoot
		});

		const branches = stdout
			.split('\n')
			.map(line => line.trim())
			.filter(line => line && !line.startsWith('*'))
			.map(line => {
				// Remove remotes/origin/ prefix and clean up
				if (line.startsWith('remotes/origin/')) {
					return line.replace('remotes/origin/', '');
				}
				return line;
			})
			.filter(branch => branch !== 'HEAD' && !branch.includes('->'))
			.sort()
			.filter((branch, index, array) => array.indexOf(branch) === index); // Remove duplicates

		outputChannel.appendLine(`Found branches: ${branches.join(', ')}`);
		return branches;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`getBranches error: ${errorMsg}`);
		throw new Error(`Failed to get branches: ${errorMsg}`);
	}
}

async function getSkipWorktreeStatus(gitRoot: string, relativePath: string): Promise<{ tracked: boolean; skipWorktree: boolean }> {
	try {
		const { stdout } = await execAsync(`git ls-files -v "${relativePath}"`, {
			cwd: gitRoot
		});

		const output = stdout.trim();
		outputChannel.appendLine(`getSkipWorktreeStatus raw output: "${output}" (length: ${output.length})`);
		
		if (output === '') {
			outputChannel.appendLine(`File not tracked: empty output`);
			return { tracked: false, skipWorktree: false };
		} else {
			const firstChar = output.charAt(0);
			const lowerFirstChar = firstChar.toLowerCase();
			outputChannel.appendLine(`First character: "${firstChar}" (lowercase: "${lowerFirstChar}")`);
			
			const isSkipWorktree = lowerFirstChar === 's';
			outputChannel.appendLine(`Parsed as skipWorktree: ${isSkipWorktree}`);
			
			return { tracked: true, skipWorktree: isSkipWorktree };
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`getSkipWorktreeStatus error: ${errorMsg}`);
		throw new Error(`Failed to check skip-worktree status: ${errorMsg}`);
	}
}



async function handleSkipWorktreeToggle(uri: vscode.Uri | any) {
	try {
		outputChannel.appendLine(`[${new Date().toISOString()}] Toggle skip-worktree command triggered`);
		
		// Handle SCM resource state context
		let actualUri: vscode.Uri;
		if (uri?.resourceUri) {
			actualUri = uri.resourceUri;
			outputChannel.appendLine(`Using resourceUri from SCM context`);
		} else if (uri?.fsPath || uri?.scheme) {
			actualUri = uri;
			outputChannel.appendLine(`Using direct URI`);
		} else {
			throw new Error('No valid file URI provided. Please right-click on a file in Explorer or Source Control.');
		}
		
		const filePath = actualUri.fsPath;
		outputChannel.appendLine(`Processing file: ${filePath}`);
		
		if (!filePath) {
			throw new Error('Could not determine file path from selection');
		}

		if (!fs.existsSync(filePath)) {
			throw new Error(`File does not exist: ${filePath}`);
		}

		const gitRoot = await getGitRoot(filePath);
		const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
		outputChannel.appendLine(`Git root: ${gitRoot}`);
		outputChannel.appendLine(`Relative path: ${relativePath}`);

		const status = await getSkipWorktreeStatus(gitRoot, relativePath);
		outputChannel.appendLine(`File status - tracked: ${status.tracked}, skipWorktree: ${status.skipWorktree}`);
		
		if (!status.tracked) {
			const errorMsg = `File "${relativePath}" is not tracked by Git.\n\nTo use skip-worktree, the file must first be added to Git tracking.\nUse: git add "${relativePath}"`;
			outputChannel.appendLine(`[ERROR] ${errorMsg}`);
			vscode.window.showErrorMessage(errorMsg, 'Open Git Documentation').then(selection => {
				if (selection === 'Open Git Documentation') {
					vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/docs/git-update-index#_skip_worktree_bit'));
				}
			});
			return;
		}

		const flag = status.skipWorktree ? '--no-skip-worktree' : '--skip-worktree';
		const action = status.skipWorktree ? 'Removing' : 'Setting';
		const command = `git update-index ${flag} "${relativePath}"`;
		
		outputChannel.appendLine(`${action} skip-worktree flag...`);
		outputChannel.appendLine(`Executing: ${command}`);

		// Toggle flag
		const result = await execAsync(command, {
			cwd: gitRoot
		});
		
		outputChannel.appendLine(`Git command output: ${result.stdout || '(no output)'}`);
		if (result.stderr) {
			outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
		}

		// Wait a moment for the git index to update
		await new Promise(resolve => setTimeout(resolve, 100));

		// Verify the change worked
		const rawCheck = await execAsync(`git ls-files -v "${relativePath}"`, { cwd: gitRoot });
		outputChannel.appendLine(`Raw git ls-files output: "${rawCheck.stdout.trim()}"`);
		
		const newStatus = await getSkipWorktreeStatus(gitRoot, relativePath);
		const expectedState = !status.skipWorktree;
		
		outputChannel.appendLine(`Verification - Expected: ${expectedState}, Got: ${newStatus.skipWorktree}`);
		
		if (newStatus.skipWorktree !== expectedState) {
			// Try one more time with a longer delay
			outputChannel.appendLine(`First verification failed, waiting longer and retrying...`);
			await new Promise(resolve => setTimeout(resolve, 500));
			
			const retryRawCheck = await execAsync(`git ls-files -v "${relativePath}"`, { cwd: gitRoot });
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
		
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorCode = (error as any)?.code;
		const stderr = (error as any)?.stderr;
		
		outputChannel.appendLine(`[ERROR] ${errorMsg}`);
		if (errorCode) outputChannel.appendLine(`Error code: ${errorCode}`);
		if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
		
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