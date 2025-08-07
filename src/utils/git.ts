import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SkipWorktreeStatus } from '../types';
import { outputChannel } from './logger';

const execAsync = promisify(exec);

export async function tryGitApiRoot(): Promise<string | undefined> {
	try {
		const ext = vscode.extensions.getExtension('vscode.git');
		if (!ext) return;
		const gitExt = ext.isActive ? ext.exports : await ext.activate();
		const api = gitExt.getAPI?.(1);
		const repo = api?.repositories?.[0];
		return repo?.rootUri?.fsPath;
	} catch {
		return;
	}
}

export async function findGitRoot(): Promise<string> {
	try {
		// Try VS Code's Git extension API first
		const apiRoot = await tryGitApiRoot();
		if (apiRoot) {
			outputChannel.appendLine(`Found Git root via VS Code Git API: ${apiRoot}`);
			return apiRoot;
		}
		
		// Try to get Git root from active editor first
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const filePath = activeEditor.document.uri.fsPath;
			outputChannel.appendLine(`Trying to find Git root from active editor: ${filePath}`);
			try {
				return await getGitRoot(filePath);
			} catch (error) {
				outputChannel.appendLine(`Active editor not in Git repo, trying workspace folders...`);
			}
		}

		// Fall back to workspace folders
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error('No workspace folder open and no active editor in a Git repository.');
		}

		// Try each workspace folder to find a Git repository
		for (const folder of workspaceFolders) {
			try {
				outputChannel.appendLine(`Checking workspace folder: ${folder.uri.fsPath}`);
				return await getGitRoot(folder.uri.fsPath);
			} catch (error) {
				outputChannel.appendLine(`Workspace folder ${folder.name} is not a Git repository`);
				continue;
			}
		}

		throw new Error('No Git repository found in workspace folders or active editor location.');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not find Git repository: ${errorMsg}`);
	}
}

export async function getGitRoot(filePath: string): Promise<string> {
	try {
		if (!filePath) {
			throw new Error('File path is undefined or empty');
		}

		let cwd = filePath;
		try {
			const st = await fsp.stat(filePath);
			if (!st.isDirectory()) {
				cwd = path.dirname(filePath);
			}
		} catch {
			cwd = path.dirname(filePath);
		}

		outputChannel.appendLine(`Checking git root from directory: ${cwd}`);

		const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd });
		const gitRoot = stdout.trim();
		outputChannel.appendLine(`Found git root: ${gitRoot}`);
		return gitRoot;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		const code = (error as any)?.code;
		const stderr = (error as any)?.stderr;
		outputChannel.appendLine(`Git command failed: ${msg}`);
		if (code) outputChannel.appendLine(`Error code: ${code}`);
		if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
		throw new Error(`Not a git repository or git command failed: ${msg}`);
	}
}

export async function getBranches(gitRoot: string): Promise<string[]> {
	try {
		const { stdout } = await execAsync(
			`git for-each-ref --format="%(refname:short)" refs/heads refs/remotes/origin`,
			{ cwd: gitRoot }
		);

		// Prefer local branch when both local & remote exist
		const all = stdout.split('\n').map(s => s.trim()).filter(Boolean);
		const locals = new Set(all.filter(b => !b.startsWith('origin/')));
		const remotesOnly = all.filter(b => b.startsWith('origin/'))
			.map(b => b.replace(/^origin\//, ''))
			.filter(b => !locals.has(b));

		const branches = [...locals, ...new Set(remotesOnly)].sort();
		outputChannel.appendLine(`Found branches: ${branches.join(', ')}`);
		return branches;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`getBranches error: ${msg}`);
		throw new Error(`Failed to get branches: ${msg}`);
	}
}

export async function getSkipWorktreeStatus(gitRoot: string, relativePath: string): Promise<SkipWorktreeStatus> {
	try {
		const { stdout } = await execAsync(`git ls-files -v -- "${relativePath}"`, {
			cwd: gitRoot
		});

		const out = stdout.trim();
		outputChannel.appendLine(`getSkipWorktreeStatus raw output: "${out}" (length: ${out.length})`);
		if (!out) return { tracked: false, skipWorktree: false };

		const tag = out.charAt(0);
		const skipWorktree = tag === 'S';
		outputChannel.appendLine(`File tag: "${tag}", skipWorktree: ${skipWorktree}`);
		return { tracked: true, skipWorktree };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(`getSkipWorktreeStatus error: ${msg}`);
		throw new Error(`Failed to check skip-worktree status: ${msg}`);
	}
}

export async function execGitCommand(command: string, cwd: string): Promise<{ stdout: string; stderr?: string }> {
	try {
		const result = await execAsync(command, { cwd });
		return { stdout: result.stdout, stderr: result.stderr };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		const stderr = (error as any)?.stderr;
		outputChannel.appendLine(`Git command failed: ${command}`);
		outputChannel.appendLine(`Error: ${msg}`);
		if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
		throw error;
	}
}