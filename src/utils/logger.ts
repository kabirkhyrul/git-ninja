import * as vscode from 'vscode';

export const outputChannel = vscode.window.createOutputChannel('Git Ninja');

export function logInfo(message: string): void {
	outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function logError(message: string, error?: any): void {
	outputChannel.appendLine(`[${new Date().toISOString()}] [ERROR] ${message}`);
	if (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const code = error?.code;
		const stderr = error?.stderr;
		
		outputChannel.appendLine(`Error details: ${errorMsg}`);
		if (code) outputChannel.appendLine(`Error code: ${code}`);
		if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
	}
}

export function showOutputChannel(): void {
	outputChannel.show();
}