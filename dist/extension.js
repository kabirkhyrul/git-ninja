"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode10 = __toESM(require("vscode"));

// src/commands/exclude.ts
var vscode3 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));
var fs = __toESM(require("fs"));

// src/utils/uri.ts
var path2 = __toESM(require("path"));

// src/utils/git.ts
var vscode2 = __toESM(require("vscode"));
var path = __toESM(require("path"));
var import_fs = require("fs");
var import_child_process = require("child_process");
var import_util = require("util");

// src/utils/logger.ts
var vscode = __toESM(require("vscode"));
var outputChannel = vscode.window.createOutputChannel("Git Ninja");
function logInfo(message) {
  outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
}
function logError(message, error) {
  outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] [ERROR] ${message}`);
  if (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const code = error?.code;
    const stderr = error?.stderr;
    outputChannel.appendLine(`Error details: ${errorMsg}`);
    if (code) outputChannel.appendLine(`Error code: ${code}`);
    if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
  }
}

// src/utils/git.ts
var execAsync = (0, import_util.promisify)(import_child_process.exec);
async function tryGitApiRoot() {
  try {
    const ext = vscode2.extensions.getExtension("vscode.git");
    if (!ext) return;
    const gitExt = ext.isActive ? ext.exports : await ext.activate();
    const api = gitExt.getAPI?.(1);
    const repo = api?.repositories?.[0];
    return repo?.rootUri?.fsPath;
  } catch {
    return;
  }
}
async function findGitRoot() {
  try {
    const apiRoot = await tryGitApiRoot();
    if (apiRoot) {
      outputChannel.appendLine(`Found Git root via VS Code Git API: ${apiRoot}`);
      return apiRoot;
    }
    const activeEditor = vscode2.window.activeTextEditor;
    if (activeEditor) {
      const filePath = activeEditor.document.uri.fsPath;
      outputChannel.appendLine(`Trying to find Git root from active editor: ${filePath}`);
      try {
        return await getGitRoot(filePath);
      } catch (error) {
        outputChannel.appendLine(`Active editor not in Git repo, trying workspace folders...`);
      }
    }
    const workspaceFolders = vscode2.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder open and no active editor in a Git repository.");
    }
    for (const folder of workspaceFolders) {
      try {
        outputChannel.appendLine(`Checking workspace folder: ${folder.uri.fsPath}`);
        return await getGitRoot(folder.uri.fsPath);
      } catch (error) {
        outputChannel.appendLine(`Workspace folder ${folder.name} is not a Git repository`);
        continue;
      }
    }
    throw new Error("No Git repository found in workspace folders or active editor location.");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not find Git repository: ${errorMsg}`);
  }
}
async function getGitRoot(filePath) {
  try {
    if (!filePath) {
      throw new Error("File path is undefined or empty");
    }
    let cwd = filePath;
    try {
      const st = await import_fs.promises.stat(filePath);
      if (!st.isDirectory()) {
        cwd = path.dirname(filePath);
      }
    } catch {
      cwd = path.dirname(filePath);
    }
    outputChannel.appendLine(`Checking git root from directory: ${cwd}`);
    const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd });
    const gitRoot = stdout.trim();
    outputChannel.appendLine(`Found git root: ${gitRoot}`);
    return gitRoot;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = error?.code;
    const stderr = error?.stderr;
    outputChannel.appendLine(`Git command failed: ${msg}`);
    if (code) outputChannel.appendLine(`Error code: ${code}`);
    if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
    throw new Error(`Not a git repository or git command failed: ${msg}`);
  }
}
async function getBranches(gitRoot) {
  try {
    const { stdout } = await execAsync(
      `git for-each-ref --format="%(refname:short)" refs/heads refs/remotes/origin`,
      { cwd: gitRoot }
    );
    const all = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    const locals = new Set(all.filter((b) => !b.startsWith("origin/")));
    const remotesOnly = all.filter((b) => b.startsWith("origin/")).map((b) => b.replace(/^origin\//, "")).filter((b) => !locals.has(b));
    const branches = [...locals, ...new Set(remotesOnly)].sort();
    outputChannel.appendLine(`Found branches: ${branches.join(", ")}`);
    return branches;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`getBranches error: ${msg}`);
    throw new Error(`Failed to get branches: ${msg}`);
  }
}
async function getSkipWorktreeStatus(gitRoot, relativePath) {
  try {
    const { stdout } = await execAsync(`git ls-files -v -- "${relativePath}"`, {
      cwd: gitRoot
    });
    const out = stdout.trim();
    outputChannel.appendLine(`getSkipWorktreeStatus raw output: "${out}" (length: ${out.length})`);
    if (!out) return { tracked: false, skipWorktree: false };
    const tag = out.charAt(0);
    const skipWorktree = tag === "S";
    outputChannel.appendLine(`File tag: "${tag}", skipWorktree: ${skipWorktree}`);
    return { tracked: true, skipWorktree };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`getSkipWorktreeStatus error: ${msg}`);
    throw new Error(`Failed to check skip-worktree status: ${msg}`);
  }
}
async function execGitCommand(command, cwd) {
  try {
    const result = await execAsync(command, { cwd });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stderr = error?.stderr;
    outputChannel.appendLine(`Git command failed: ${command}`);
    outputChannel.appendLine(`Error: ${msg}`);
    if (stderr) outputChannel.appendLine(`Stderr: ${stderr}`);
    throw error;
  }
}

// src/utils/uri.ts
async function extractUriContext(uri) {
  if (!uri) {
    throw new Error("No file URI provided");
  }
  let actualUri;
  if (uri.resourceUri) {
    actualUri = uri.resourceUri;
    outputChannel.appendLine(`Using resourceUri from SCM context`);
  } else if (uri.fsPath || uri.scheme) {
    actualUri = uri;
    outputChannel.appendLine(`Using direct URI`);
  } else {
    throw new Error("Could not extract URI from provided object");
  }
  const filePath = actualUri.fsPath;
  outputChannel.appendLine(`File path: ${filePath}`);
  if (!filePath) {
    throw new Error("Could not get file path from URI");
  }
  const gitRoot = await getGitRoot(filePath);
  const relativePath = path2.relative(gitRoot, filePath).replace(/\\/g, "/");
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

// src/commands/exclude.ts
async function handleExclude(uri) {
  try {
    logInfo("Toggle exclude command triggered");
    outputChannel.appendLine(`URI received: ${uri ? JSON.stringify(uri, null, 2) : "undefined"}`);
    const context = await extractUriContext(uri);
    outputChannel.appendLine(`File exists: ${fs.existsSync(context.filePath)}`);
    outputChannel.appendLine(`Working directory: ${process.cwd()}`);
    const gitInfoDir = path3.join(context.gitRoot, ".git", "info");
    const excludePath = path3.join(gitInfoDir, "exclude");
    if (!fs.existsSync(gitInfoDir)) {
      fs.mkdirSync(gitInfoDir, { recursive: true });
      outputChannel.appendLine(`Created .git/info directory`);
    }
    if (!fs.existsSync(excludePath)) {
      fs.writeFileSync(excludePath, "");
      outputChannel.appendLine(`Created exclude file`);
    }
    const content = fs.readFileSync(excludePath, "utf8");
    const lines = content.split("\n").map((line) => line.trim()).filter((line) => line);
    if (!lines.includes(context.relativePath)) {
      const newContent = content.trim() ? `${content.trim()}
${context.relativePath}
` : `${context.relativePath}
`;
      fs.writeFileSync(excludePath, newContent);
      outputChannel.appendLine(`Added entry to exclude file`);
      vscode3.window.showInformationMessage(`Added to .git/info/exclude: ${context.relativePath}`);
    } else {
      const filteredLines = lines.filter((line) => line !== context.relativePath);
      const newContent = filteredLines.length > 0 ? filteredLines.join("\n") + "\n" : "";
      fs.writeFileSync(excludePath, newContent);
      outputChannel.appendLine(`Removed entry from exclude file`);
      vscode3.window.showInformationMessage(`Removed from .git/info/exclude: ${context.relativePath}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Toggle exclude failed", error);
    vscode3.window.showErrorMessage(`Error: ${errorMsg}`);
  }
}

// src/commands/skipWorktree.ts
var vscode4 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
async function handleSkipWorktreeToggle(uri) {
  try {
    logInfo("Toggle skip-worktree command triggered");
    const context = await extractUriContext(uri);
    outputChannel.appendLine(`Processing file: ${context.filePath}`);
    if (!context.filePath) {
      throw new Error("Could not determine file path from selection");
    }
    if (!fs2.existsSync(context.filePath)) {
      throw new Error(`File does not exist: ${context.filePath}`);
    }
    const status = await getSkipWorktreeStatus(context.gitRoot, context.relativePath);
    outputChannel.appendLine(`File status - tracked: ${status.tracked}, skipWorktree: ${status.skipWorktree}`);
    if (!status.tracked) {
      const errorMsg = `File "${context.relativePath}" is not tracked by Git.

To use skip-worktree, the file must first be added to Git tracking.
Use: git add "${context.relativePath}"`;
      logError("File not tracked", errorMsg);
      vscode4.window.showErrorMessage(errorMsg, "Open Git Documentation").then((selection) => {
        if (selection === "Open Git Documentation") {
          vscode4.env.openExternal(vscode4.Uri.parse("https://git-scm.com/docs/git-update-index#_skip_worktree_bit"));
        }
      });
      return;
    }
    const flag = status.skipWorktree ? "--no-skip-worktree" : "--skip-worktree";
    const action = status.skipWorktree ? "Removing" : "Setting";
    const command = `git update-index ${flag} -- "${context.relativePath}"`;
    outputChannel.appendLine(`${action} skip-worktree flag...`);
    outputChannel.appendLine(`Executing: ${command}`);
    const result = await execGitCommand(command, context.gitRoot);
    outputChannel.appendLine(`Git command output: ${result.stdout || "(no output)"}`);
    if (result.stderr) {
      outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    await verifySkipWorktreeChange(context.gitRoot, context.relativePath, context.filePath, status.skipWorktree);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code;
    const stderr = error?.stderr;
    logError("Git skip-worktree failed", error);
    let userMessage = `Git skip-worktree failed: ${errorMsg}`;
    if (stderr && typeof stderr === "string") {
      userMessage += `

Git error: ${stderr.trim()}`;
    }
    vscode4.window.showErrorMessage(userMessage, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        outputChannel.show();
      }
    });
  }
}
async function verifySkipWorktreeChange(gitRoot, relativePath, filePath, oldStatus) {
  const rawCheck = await execGitCommand(`git ls-files -v -- "${relativePath}"`, gitRoot);
  outputChannel.appendLine(`Raw git ls-files output: "${rawCheck.stdout.trim()}"`);
  const newStatus = await getSkipWorktreeStatus(gitRoot, relativePath);
  const expectedState = !oldStatus;
  outputChannel.appendLine(`Verification - Expected: ${expectedState}, Got: ${newStatus.skipWorktree}`);
  if (newStatus.skipWorktree !== expectedState) {
    outputChannel.appendLine(`First verification failed, waiting longer and retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const retryRawCheck = await execGitCommand(`git ls-files -v -- "${relativePath}"`, gitRoot);
    outputChannel.appendLine(`Retry raw git ls-files output: "${retryRawCheck.stdout.trim()}"`);
    const retryStatus = await getSkipWorktreeStatus(gitRoot, relativePath);
    outputChannel.appendLine(`Retry verification - Expected: ${expectedState}, Got: ${retryStatus.skipWorktree}`);
    if (retryStatus.skipWorktree !== expectedState) {
      outputChannel.appendLine(`Git command may have succeeded but verification failed. This could be a timing issue.`);
      vscode4.window.showWarningMessage(`Command executed but status verification failed. Check Git Ninja output for details.`, "Show Output").then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
      return;
    } else {
      newStatus.skipWorktree = retryStatus.skipWorktree;
    }
  }
  const statusText = newStatus.skipWorktree ? "skip-worktree (Git will ignore local changes)" : "normal tracking (Git will detect changes)";
  const shortStatus = newStatus.skipWorktree ? "ignoring local changes" : "tracking changes";
  outputChannel.appendLine(`Successfully set ${relativePath} to: ${statusText}`);
  vscode4.window.showInformationMessage(`${path4.basename(filePath)} is now ${shortStatus}`, "Show Details").then((selection) => {
    if (selection === "Show Details") {
      outputChannel.show();
    }
  });
}

// src/commands/checkout.ts
var vscode5 = __toESM(require("vscode"));
var path5 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));
async function handleCheckoutFromBranch(uri) {
  try {
    logInfo("Checkout file from branch command triggered");
    const context = await extractUriContext(uri);
    outputChannel.appendLine(`Processing file: ${context.filePath}`);
    if (!context.filePath) {
      throw new Error("Could not determine file path from selection");
    }
    const branches = await getBranches(context.gitRoot);
    if (branches.length === 0) {
      throw new Error("No branches found in this repository");
    }
    const selectedBranch = await vscode5.window.showQuickPick(branches, {
      placeHolder: `Select branch to checkout ${path5.basename(context.filePath)} from`,
      title: `Checkout ${path5.basename(context.filePath)} from Branch`,
      ignoreFocusOut: true
    });
    if (!selectedBranch) {
      outputChannel.appendLine(`User cancelled branch selection`);
      return;
    }
    outputChannel.appendLine(`Selected branch: ${selectedBranch}`);
    try {
      await execGitCommand(`git cat-file -e ${selectedBranch}:"${context.relativePath}"`, context.gitRoot);
    } catch (error) {
      throw new Error(`File "${context.relativePath}" does not exist in branch "${selectedBranch}"`);
    }
    const confirmation = await vscode5.window.showWarningMessage(
      `This will replace "${path5.basename(context.filePath)}" with the version from branch "${selectedBranch}". Any local changes will be lost.`,
      { modal: true },
      "Checkout File",
      "Cancel"
    );
    if (confirmation !== "Checkout File") {
      outputChannel.appendLine(`User cancelled checkout confirmation`);
      return;
    }
    const command = `git checkout ${selectedBranch} -- "${context.relativePath}"`;
    outputChannel.appendLine(`Executing: ${command}`);
    const result = await execGitCommand(command, context.gitRoot);
    outputChannel.appendLine(`Git command output: ${result.stdout || "(no output)"}`);
    if (result.stderr) {
      outputChannel.appendLine(`Git command stderr: ${result.stderr}`);
    }
    if (fs3.existsSync(context.filePath)) {
      outputChannel.appendLine(`Successfully checked out ${context.relativePath} from branch ${selectedBranch}`);
      vscode5.window.showInformationMessage(
        `\u2705 ${path5.basename(context.filePath)} updated from branch "${selectedBranch}"`,
        "Show File",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show File") {
          vscode5.window.showTextDocument(context.actualUri);
        } else if (selection === "Show Output") {
          outputChannel.show();
        }
      });
    } else {
      throw new Error("File checkout completed but file not found on disk");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Git checkout failed", error);
    vscode5.window.showErrorMessage(`Git checkout failed: ${errorMsg}`, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        outputChannel.show();
      }
    });
  }
}

// src/commands/cleanup.ts
var vscode6 = __toESM(require("vscode"));
async function handleCleanup() {
  try {
    logInfo("Git cleanup command triggered");
    const gitRoot = await findGitRoot();
    outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);
    outputChannel.appendLine("Starting Git cleanup process...");
    outputChannel.appendLine("Step 1: Pruning remote references...");
    const pruneResult = await execGitCommand("git remote prune origin", gitRoot);
    outputChannel.appendLine(`Prune output: ${pruneResult.stdout || "(no output)"}`);
    if (pruneResult.stderr) {
      outputChannel.appendLine(`Prune stderr: ${pruneResult.stderr}`);
    }
    outputChannel.appendLine("Step 2: Finding orphaned local branches...");
    const branchResult = await execGitCommand("git branch -vv", gitRoot);
    const orphanedBranches = branchResult.stdout.split("\n").filter((line) => line.includes(": gone]")).filter((line) => !line.trim().startsWith("*")).map((line) => line.trim().split(/\s+/)[0]).filter((branch) => branch && branch !== "*");
    outputChannel.appendLine(`Found orphaned branches: ${orphanedBranches.length > 0 ? orphanedBranches.join(", ") : "none"}`);
    if (orphanedBranches.length === 0) {
      outputChannel.appendLine("No orphaned branches found. Cleanup complete.");
      vscode6.window.showInformationMessage(
        "\u2705 Git cleanup complete! No orphaned branches found.",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
      return;
    }
    const confirmation = await vscode6.window.showWarningMessage(
      `Found ${orphanedBranches.length} orphaned local branch${orphanedBranches.length > 1 ? "es" : ""}: ${orphanedBranches.join(", ")}

Delete ${orphanedBranches.length > 1 ? "these branches" : "this branch"}? This action cannot be undone.`,
      { modal: true },
      "Delete Branches",
      "Skip Deletion"
    );
    if (confirmation === "Delete Branches") {
      await deleteOrphanedBranches(gitRoot, orphanedBranches);
    } else {
      outputChannel.appendLine("User chose to skip branch deletion. Cleanup complete.");
      vscode6.window.showInformationMessage(
        "\u2705 Git cleanup complete! Remote pruning done, branch deletion skipped.",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Git cleanup failed", error);
    vscode6.window.showErrorMessage(`Git cleanup failed: ${errorMsg}`, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        outputChannel.show();
      }
    });
  }
}
async function deleteOrphanedBranches(gitRoot, branches) {
  outputChannel.appendLine("Step 3: Deleting orphaned branches...");
  let deletedCount = 0;
  const failedDeletions = [];
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
  const message = failedDeletions.length === 0 ? `\u2705 Git cleanup complete! Deleted ${deletedCount} orphaned branch${deletedCount > 1 ? "es" : ""}.` : `\u26A0\uFE0F Git cleanup partially complete. Deleted ${deletedCount}/${branches.length} branches. Failed: ${failedDeletions.join(", ")}`;
  vscode6.window.showInformationMessage(message, "Show Output").then((selection) => {
    if (selection === "Show Output") {
      outputChannel.show();
    }
  });
}

// src/commands/cleanIgnored.ts
var vscode7 = __toESM(require("vscode"));
async function handleCleanIgnored() {
  try {
    logInfo("Git clean ignored files command triggered");
    const gitRoot = await findGitRoot();
    outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);
    outputChannel.appendLine("Step 1: Previewing ignored files to be deleted...");
    const previewResult = await execGitCommand("git clean -ndX", gitRoot);
    const filesToDelete = previewResult.stdout.trim();
    outputChannel.appendLine(`Preview output: ${filesToDelete || "(no ignored files found)"}`);
    if (!filesToDelete) {
      outputChannel.appendLine("No ignored files found to clean.");
      vscode7.window.showInformationMessage(
        "\u2705 No ignored files found to clean.",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
      return;
    }
    const fileList = filesToDelete.split("\n").filter((line) => line.startsWith("Would remove ")).map((line) => line.replace("Would remove ", "").trim()).filter((file) => file);
    const fileCount = fileList.length;
    const previewText = fileList.length <= 10 ? fileList.join("\n") : fileList.slice(0, 10).join("\n") + `
... and ${fileList.length - 10} more files`;
    const confirmation = await vscode7.window.showWarningMessage(
      `Found ${fileCount} ignored file${fileCount > 1 ? "s" : ""} to delete:

${previewText}

This will permanently delete all files listed in .gitignore. This action cannot be undone.`,
      { modal: true },
      "Delete Files",
      "Show All Files",
      "Cancel"
    );
    if (confirmation === "Show All Files") {
      const shouldDelete = await showAllFilesAndConfirm(fileList, fileCount);
      if (!shouldDelete) return;
    } else if (confirmation !== "Delete Files") {
      outputChannel.appendLine("User cancelled deletion.");
      return;
    }
    await performCleanIgnored(gitRoot);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Git clean ignored files failed", error);
    vscode7.window.showErrorMessage(`Git clean ignored files failed: ${errorMsg}`, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        outputChannel.show();
      }
    });
  }
}
async function showAllFilesAndConfirm(fileList, fileCount) {
  outputChannel.appendLine("--- Files to be deleted ---");
  fileList.forEach((file) => outputChannel.appendLine(`  ${file}`));
  outputChannel.show();
  const secondConfirmation = await vscode7.window.showWarningMessage(
    `Delete all ${fileCount} ignored files? This action cannot be undone.`,
    { modal: true },
    "Delete Files",
    "Cancel"
  );
  if (secondConfirmation !== "Delete Files") {
    outputChannel.appendLine("User cancelled deletion after viewing files.");
    return false;
  }
  return true;
}
async function performCleanIgnored(gitRoot) {
  outputChannel.appendLine("Step 2: Deleting ignored files...");
  const deleteResult = await execGitCommand("git clean -fdX", gitRoot);
  outputChannel.appendLine(`Delete output: ${deleteResult.stdout || "(no output)"}`);
  if (deleteResult.stderr) {
    outputChannel.appendLine(`Delete stderr: ${deleteResult.stderr}`);
  }
  const deletedFiles = deleteResult.stdout.trim();
  const actualDeletedList = deletedFiles.split("\n").filter((line) => line.startsWith("Removing ")).map((line) => line.replace("Removing ", "").trim()).filter((file) => file);
  const actualCount = actualDeletedList.length;
  outputChannel.appendLine(`Successfully deleted ${actualCount} ignored file${actualCount > 1 ? "s" : ""}`);
  actualDeletedList.forEach((file) => outputChannel.appendLine(`  Deleted: ${file}`));
  vscode7.window.showInformationMessage(
    `\u2705 Deleted ${actualCount} ignored file${actualCount > 1 ? "s" : ""} from .gitignore`,
    "Show Output"
  ).then((selection) => {
    if (selection === "Show Output") {
      outputChannel.show();
    }
  });
}

// src/commands/pruneRemotes.ts
var vscode8 = __toESM(require("vscode"));
async function handlePruneRemotes() {
  try {
    logInfo("Git prune remotes command triggered");
    const gitRoot = await findGitRoot();
    outputChannel.appendLine(`Working in Git repository: ${gitRoot}`);
    outputChannel.appendLine("Starting Git prune remotes process...");
    outputChannel.appendLine("Step 1: Fetching origin with prune...");
    const fetchResult = await execGitCommand("git fetch origin --prune", gitRoot);
    outputChannel.appendLine(`Fetch output: ${fetchResult.stdout || "(no output)"}`);
    if (fetchResult.stderr) {
      outputChannel.appendLine(`Fetch stderr: ${fetchResult.stderr}`);
    }
    outputChannel.appendLine("Step 2: Finding local branches without remotes...");
    const currentBranchResult = await execGitCommand("git branch --show-current", gitRoot);
    const currentBranch = currentBranchResult.stdout.trim();
    const localBranchesResult = await execGitCommand("git branch", gitRoot);
    const localBranches = localBranchesResult.stdout.split("\n").map((line) => line.replace(/^\*?\s+/, "").trim()).filter((branch) => branch && branch !== currentBranch);
    outputChannel.appendLine(`Found local branches (excluding current): ${localBranches.join(", ")}`);
    if (localBranches.length === 0) {
      outputChannel.appendLine("No local branches found to check. Prune complete.");
      vscode8.window.showInformationMessage(
        "\u2705 Git prune complete! No local branches found to check.",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
      return;
    }
    const deletableBranches = [];
    const protectedBranches = [];
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
    outputChannel.appendLine(`Deletable branches: ${deletableBranches.length > 0 ? deletableBranches.join(", ") : "none"}`);
    outputChannel.appendLine(`Protected branches: ${protectedBranches.length > 0 ? protectedBranches.join(", ") : "none"}`);
    if (deletableBranches.length === 0) {
      let message2 = "\u2705 Git prune complete! Remote references pruned.";
      if (protectedBranches.length > 0) {
        message2 += ` Found ${protectedBranches.length} local branch${protectedBranches.length > 1 ? "es" : ""} that cannot be safely deleted.`;
      }
      vscode8.window.showInformationMessage(message2, "Show Output").then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
      return;
    }
    let message = `Git prune found ${deletableBranches.length} local branch${deletableBranches.length > 1 ? "es" : ""} that can be safely deleted: ${deletableBranches.join(", ")}`;
    if (protectedBranches.length > 0) {
      message += `

${protectedBranches.length} branch${protectedBranches.length > 1 ? "es" : ""} will be kept (not fully merged): ${protectedBranches.join(", ")}`;
    }
    message += "\n\nDelete the safe branches?";
    const confirmation = await vscode8.window.showWarningMessage(
      message,
      { modal: true },
      "Delete Safe Branches",
      "Skip Deletion"
    );
    if (confirmation === "Delete Safe Branches") {
      await deleteSafeBranches(gitRoot, deletableBranches, protectedBranches.length);
    } else {
      outputChannel.appendLine("User chose to skip branch deletion. Prune complete.");
      vscode8.window.showInformationMessage(
        "\u2705 Git prune complete! Remote pruning done, branch deletion skipped.",
        "Show Output"
      ).then((selection) => {
        if (selection === "Show Output") {
          outputChannel.show();
        }
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Git prune remotes failed", error);
    vscode8.window.showErrorMessage(`Git prune remotes failed: ${errorMsg}`, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        outputChannel.show();
      }
    });
  }
}
async function deleteSafeBranches(gitRoot, branches, protectedCount) {
  outputChannel.appendLine("Step 3: Deleting safe local branches...");
  let deletedCount = 0;
  const failedDeletions = [];
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
  let message = "";
  if (failedDeletions.length === 0) {
    message = `\u2705 Git prune complete! Deleted ${deletedCount} local branch${deletedCount > 1 ? "es" : ""}.`;
    if (protectedCount > 0) {
      message += ` Kept ${protectedCount} protected branch${protectedCount > 1 ? "es" : ""}.`;
    }
  } else {
    message = `\u26A0\uFE0F Git prune partially complete. Deleted ${deletedCount}/${branches.length} branches. Failed: ${failedDeletions.join(", ")}`;
    if (protectedCount > 0) {
      message += `. Kept ${protectedCount} protected branch${protectedCount > 1 ? "es" : ""}.`;
    }
  }
  vscode8.window.showInformationMessage(message, "Show Output").then((selection) => {
    if (selection === "Show Output") {
      outputChannel.show();
    }
  });
}

// src/commands/cleanUntrackedIgnored.ts
var vscode9 = __toESM(require("vscode"));
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var execAsync2 = (0, import_util2.promisify)(import_child_process2.exec);
async function handleCleanUntrackedIgnored() {
  try {
    const gitRoot = await findGitRoot();
    if (!gitRoot) {
      vscode9.window.showErrorMessage("Not in a git repository.");
      return;
    }
    const result = await vscode9.window.showWarningMessage(
      "This will permanently delete all untracked and ignored files. This action cannot be undone.",
      { modal: true },
      "Continue",
      "Cancel"
    );
    if (result !== "Continue") {
      return;
    }
    outputChannel.show();
    outputChannel.appendLine("Cleaning untracked and ignored files...");
    const { stdout, stderr } = await execAsync2("git clean -Xfd", { cwd: gitRoot });
    if (stderr) {
      outputChannel.appendLine(`Warning: ${stderr}`);
    }
    if (stdout.trim()) {
      outputChannel.appendLine(`Removed files:
${stdout}`);
      vscode9.window.showInformationMessage("Successfully cleaned untracked and ignored files.");
    } else {
      outputChannel.appendLine("No untracked or ignored files to remove.");
      vscode9.window.showInformationMessage("No untracked or ignored files found to clean.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error cleaning untracked and ignored files: ${errorMessage}`);
    vscode9.window.showErrorMessage(`Failed to clean untracked and ignored files: ${errorMessage}`);
  }
}

// src/extension.ts
function activate(context) {
  const toggleExclude = vscode10.commands.registerCommand("git-exclude.toggle-exclude", async (uri) => {
    await handleExclude(uri);
  });
  const toggleSkipWorktree = vscode10.commands.registerCommand("git-exclude.toggle-skip-worktree", async (uri) => {
    await handleSkipWorktreeToggle(uri);
  });
  const cleanup = vscode10.commands.registerCommand("git-exclude.cleanup", async () => {
    await handleCleanup();
  });
  const cleanIgnored = vscode10.commands.registerCommand("git-exclude.clean-ignored", async () => {
    await handleCleanIgnored();
  });
  const checkoutFromBranch = vscode10.commands.registerCommand("git-exclude.checkout-from-branch", async (uri) => {
    await handleCheckoutFromBranch(uri);
  });
  const pruneRemotes = vscode10.commands.registerCommand("git-exclude.prune-remotes", async () => {
    await handlePruneRemotes();
  });
  const cleanUntrackedIgnored = vscode10.commands.registerCommand("git-exclude.clean-untracked-ignored", async () => {
    await handleCleanUntrackedIgnored();
  });
  context.subscriptions.push(toggleExclude, toggleSkipWorktree, cleanup, cleanIgnored, checkoutFromBranch, pruneRemotes, cleanUntrackedIgnored, outputChannel);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
