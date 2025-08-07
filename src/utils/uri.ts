import * as vscode from 'vscode';
import * as path from 'path';
import { UriContext } from '../types';
import { getGitRoot } from './git';
import { outputChannel } from './logger';

export async function extractUriContext(uri: vscode.Uri | any): Promise<UriContext> {
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

	const gitRoot = await getGitRoot(filePath);
	const relativePath = path.relative(gitRoot, filePath).replace(/\\/g, '/');
	
	outputChannel.appendLine(`Git root: ${gitRoot}`);
	outputChannel.appendLine(`Relative path: ${relativePath}`);

	return {
		uri,
		actualUri,
		filePath,
		relativePath,
		gitRoot
	};
}