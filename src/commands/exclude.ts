import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { extractUriContext } from '../utils/uri';
import { getGitRoot } from '../utils/git';
import { logInfo, logError, outputChannel } from '../utils/logger';

export async function handleExclude(uri: vscode.Uri | any): Promise<void> {
	try {
		logInfo('Toggle exclude command triggered');
		outputChannel.appendLine(`URI received: ${uri ? JSON.stringify(uri, null, 2) : 'undefined'}`);
		
		const context = await extractUriContext(uri);
		
		outputChannel.appendLine(`File exists: ${fs.existsSync(context.filePath)}`);
		outputChannel.appendLine(`Working directory: ${process.cwd()}`);
		
		const gitInfoDir = path.join(context.gitRoot, '.git', 'info');
		const excludePath = path.join(gitInfoDir, 'exclude');

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
		
		if (!lines.includes(context.relativePath)) {
			// Add entry
			const newContent = content.trim() ? `${content.trim()}\n${context.relativePath}\n` : `${context.relativePath}\n`;
			fs.writeFileSync(excludePath, newContent);
			outputChannel.appendLine(`Added entry to exclude file`);
			vscode.window.showInformationMessage(`Added to .git/info/exclude: ${context.relativePath}`);
		} else {
			// Remove entry
			const filteredLines = lines.filter(line => line !== context.relativePath);
			const newContent = filteredLines.length > 0 ? filteredLines.join('\n') + '\n' : '';
			fs.writeFileSync(excludePath, newContent);
			outputChannel.appendLine(`Removed entry from exclude file`);
			vscode.window.showInformationMessage(`Removed from .git/info/exclude: ${context.relativePath}`);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logError('Toggle exclude failed', error);
		vscode.window.showErrorMessage(`Error: ${errorMsg}`);
	}
}

export async function isFileInExclude(filePath: string): Promise<boolean> {
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