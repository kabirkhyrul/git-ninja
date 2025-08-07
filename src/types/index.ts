import * as vscode from 'vscode';

export interface SkipWorktreeStatus {
	tracked: boolean;
	skipWorktree: boolean;
}

export interface GitCommandResult {
	stdout: string;
	stderr?: string;
}

export interface UriContext {
	uri: vscode.Uri | any;
	actualUri: vscode.Uri;
	filePath: string;
	relativePath: string;
	gitRoot: string;
}