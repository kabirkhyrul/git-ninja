"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function activate(context) {
    const output = vscode.window.createOutputChannel('Git Ninja');
    const disposable = vscode.commands.registerCommand('gitNinja.generateCommitMessage', async (scmContext) => {
        output.show(true);
        try {
            await generateCommitMessages(output, scmContext);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(`[error] ${message}`);
            void vscode.window.showErrorMessage(`Git Ninja failed: ${message}`);
        }
    });
    const toggleExcludeDisposable = vscode.commands.registerCommand('gitNinja.toggleExcludeFile', async (uri) => {
        try {
            const target = await resolveTargetUri(uri);
            await toggleExcludeFile(target, output);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(`[error] ${message}`);
            void vscode.window.showErrorMessage(`Git Ninja failed: ${message}`);
        }
    });
    const checkoutFromBranchDisposable = vscode.commands.registerCommand('gitNinja.checkoutFileFromBranch', async (uri) => {
        try {
            const target = await resolveTargetUri(uri);
            await checkoutFileFromBranch(target, output);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(`[error] ${message}`);
            void vscode.window.showErrorMessage(`Git Ninja failed: ${message}`);
        }
    });
    context.subscriptions.push(disposable, toggleExcludeDisposable, checkoutFromBranchDisposable, output);
}
function deactivate() { }
async function generateCommitMessages(output, scmContext) {
    const git = getGitApi();
    if (!git) {
        throw new Error('VS Code Git extension is unavailable.');
    }
    const config = vscode.workspace.getConfiguration('gitNinja');
    const debug = config.get('debug', true);
    const apiUrl = config.get('apiUrl', 'http://127.0.0.1:11434/api/generate');
    const model = config.get('model', 'llama3.2');
    const systemPrompt = config.get('systemPrompt', 'You write concise, high-quality conventional commit messages. Return only the final commit message. Prefer a single line. Use imperative mood.');
    const diffMaxChars = config.get('diffMaxChars', 12000);
    const applyToAllRepositories = config.get('applyToAllRepositories', true);
    log(output, debug, `Starting generation with model "${model}"`);
    log(output, debug, `Detected ${git.repositories.length} open repositories`);
    const repositories = resolveRepositories(git, scmContext, applyToAllRepositories);
    if (repositories.length === 0) {
        throw new Error('No matching git repository was found.');
    }
    log(output, debug, `Processing ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'}`);
    const generatedMessages = [];
    for (const repository of repositories) {
        const commitMessage = await generateCommitMessageForRepository(repository, output, debug, apiUrl, model, systemPrompt, diffMaxChars);
        generatedMessages.push(commitMessage);
    }
    if (generatedMessages.length === 1) {
        void vscode.window.showInformationMessage('Commit message generated and copied to clipboard.');
        return;
    }
    void vscode.window.showInformationMessage(`Generated commit messages for ${generatedMessages.length} repositories.`);
}
async function generateCommitMessageForRepository(repository, output, debug, apiUrl, model, systemPrompt, diffMaxChars) {
    const repoPath = repository.rootUri.fsPath;
    log(output, debug, `Collecting changes for ${repoPath}`);
    const gitContext = await collectGitContext(repoPath, output, debug, diffMaxChars);
    const prompt = buildPrompt(systemPrompt, gitContext);
    log(output, debug, `Preparing Ollama request for ${repoPath}`);
    const payload = {
        model,
        system: systemPrompt,
        prompt,
        stream: false
    };
    log(output, debug, `Sending request to Ollama for ${repoPath}`);
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    log(output, debug, `Received Ollama response for ${repoPath} (${response.status} ${response.statusText})`);
    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}: ${rawText}`);
    }
    const parsed = JSON.parse(rawText);
    if (parsed.error) {
        throw new Error(parsed.error);
    }
    const commitMessage = sanitizeCommitMessage(parsed.response);
    if (!commitMessage) {
        throw new Error('Ollama returned an empty commit message.');
    }
    log(output, debug, `Applying generated commit message to SCM input for ${repoPath}`);
    await vscode.env.clipboard.writeText(commitMessage);
    repository.inputBox.value = commitMessage;
    log(output, debug, `Commit message applied for ${repoPath}`);
    return commitMessage;
}
async function collectGitContext(cwd, output, debug, diffMaxChars) {
    const status = await runGit(['status', '--short', '--untracked-files=no'], cwd, output, debug);
    const stagedDiff = await runGit(['diff', '--cached', '--no-ext-diff', '--unified=0', '--diff-filter=MDRTUXB'], cwd, output, debug);
    const unstagedDiff = await runGit(['diff', '--no-ext-diff', '--unified=0', '--diff-filter=MDRTUXB'], cwd, output, debug);
    if (!status.trim() && !stagedDiff.trim() && !unstagedDiff.trim()) {
        throw new Error('No supported git changes found. Newly created files are skipped.');
    }
    const diffBody = [
        'Git status:',
        status || '(empty)',
        '',
        'Staged diff:',
        stagedDiff || '(empty)',
        '',
        'Unstaged diff:',
        unstagedDiff || '(empty)'
    ].join('\n');
    const trimmed = diffBody.slice(0, diffMaxChars);
    if (trimmed.length < diffBody.length) {
        log(output, debug, `Trimmed diff payload for ${cwd}`);
    }
    return trimmed;
}
async function runGit(args, cwd, output, debug) {
    log(output, debug, `Running git ${args.join(' ')}`);
    try {
        const { stdout, stderr } = await execFileAsync('git', args, { cwd, maxBuffer: 1024 * 1024 * 8 });
        if (stderr.trim()) {
            log(output, debug, `git reported stderr for ${cwd}`);
        }
        return stdout.trim();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`git ${args.join(' ')} failed: ${message}`);
    }
}
function buildPrompt(systemPrompt, gitContext) {
    return [
        systemPrompt,
        '',
        'Summarize the following repository changes as one commit message.',
        'Return only the commit message and nothing else.',
        '',
        gitContext
    ].join('\n');
}
function sanitizeCommitMessage(value) {
    return (value ?? '')
        .trim()
        .replace(/^["'`]+|["'`]+$/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
}
function log(output, debug, message) {
    if (!debug || !output) {
        return;
    }
    output.appendLine(`[debug] ${message}`);
}
function getGitApi() {
    const extension = vscode.extensions.getExtension('vscode.git');
    return extension?.exports?.getAPI(1);
}
function resolveRepositories(git, scmContext, applyToAllRepositories) {
    const contextPath = scmContext?._rootUri?.fsPath ?? scmContext?.rootUri?.fsPath;
    if (contextPath) {
        return git.repositories.filter((repository) => repository.rootUri.fsPath === contextPath);
    }
    if (applyToAllRepositories) {
        return git.repositories;
    }
    const activeWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!activeWorkspacePath) {
        return [];
    }
    return git.repositories.filter((repository) => repository.rootUri.fsPath === activeWorkspacePath);
}
async function resolveTargetUri(uri) {
    if (uri?.scheme === 'file') {
        return uri;
    }
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri?.scheme === 'file') {
        return activeUri;
    }
    throw new Error('No file is selected.');
}
async function toggleExcludeFile(uri, output) {
    const gitRoot = await getGitRoot(uri.fsPath);
    const relativePath = toRelativeGitPath(gitRoot, uri.fsPath);
    const gitInfoDir = path.join(gitRoot, '.git', 'info');
    const excludePath = path.join(gitInfoDir, 'exclude');
    output.show(true);
    output.appendLine(`[progress] Toggling exclude for ${relativePath}`);
    fs.mkdirSync(gitInfoDir, { recursive: true });
    if (!fs.existsSync(excludePath)) {
        fs.writeFileSync(excludePath, '', 'utf8');
    }
    const content = fs.readFileSync(excludePath, 'utf8');
    const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.includes(relativePath)) {
        const nextContent = lines.filter((line) => line !== relativePath).join('\n');
        fs.writeFileSync(excludePath, nextContent ? `${nextContent}\n` : '', 'utf8');
        void vscode.window.showInformationMessage(`Removed from .git/info/exclude: ${relativePath}`);
        output.appendLine(`[progress] Removed ${relativePath} from exclude`);
        return;
    }
    const nextContent = content.trim() ? `${content.trim()}\n${relativePath}\n` : `${relativePath}\n`;
    fs.writeFileSync(excludePath, nextContent, 'utf8');
    void vscode.window.showInformationMessage(`Added to .git/info/exclude: ${relativePath}`);
    output.appendLine(`[progress] Added ${relativePath} to exclude`);
}
async function checkoutFileFromBranch(uri, output) {
    const gitRoot = await getGitRoot(uri.fsPath);
    const relativePath = toRelativeGitPath(gitRoot, uri.fsPath);
    const branches = await getBranches(gitRoot);
    if (branches.length === 0) {
        throw new Error('No branches found in this repository.');
    }
    const selectedBranch = await vscode.window.showQuickPick(branches, {
        title: `Checkout ${path.basename(uri.fsPath)} from Branch`,
        placeHolder: `Select branch to checkout ${path.basename(uri.fsPath)} from`,
        ignoreFocusOut: true
    });
    if (!selectedBranch) {
        output.appendLine(`[progress] Checkout cancelled for ${relativePath}`);
        return;
    }
    output.show(true);
    output.appendLine(`[progress] Validating ${relativePath} in branch ${selectedBranch}`);
    try {
        await runGit(['cat-file', '-e', `${selectedBranch}:${relativePath}`], gitRoot, output, false);
    }
    catch {
        throw new Error(`File "${relativePath}" does not exist in branch "${selectedBranch}".`);
    }
    const confirmation = await vscode.window.showWarningMessage(`Replace "${path.basename(uri.fsPath)}" with the version from branch "${selectedBranch}"? Local changes in this file will be lost.`, { modal: true }, 'Checkout File', 'Cancel');
    if (confirmation !== 'Checkout File') {
        output.appendLine(`[progress] Checkout confirmation cancelled for ${relativePath}`);
        return;
    }
    output.appendLine(`[progress] Checking out ${relativePath} from ${selectedBranch}`);
    await runGit(['checkout', selectedBranch, '--', relativePath], gitRoot, output, false);
    await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
    if (vscode.window.activeTextEditor?.document.uri.fsPath === uri.fsPath) {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    }
    void vscode.window.showInformationMessage(`${path.basename(uri.fsPath)} updated from branch "${selectedBranch}".`);
    output.appendLine(`[progress] Checkout completed for ${relativePath}`);
}
async function getGitRoot(filePath) {
    const root = await runGit(['rev-parse', '--show-toplevel'], path.dirname(filePath), undefined, false);
    return root.trim();
}
async function getBranches(gitRoot) {
    const output = await runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'], gitRoot, undefined, false);
    return Array.from(new Set(output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.endsWith('/HEAD'))));
}
function toRelativeGitPath(gitRoot, filePath) {
    return path.relative(gitRoot, filePath).replace(/\\/g, '/');
}
//# sourceMappingURL=extension.js.map