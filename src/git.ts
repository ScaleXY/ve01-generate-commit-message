import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { ChangedFile, ChangeMode, ChangeStats, GitChanges } from "./types";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;

interface GitCommandResult {
  stdout: string;
  stderr: string;
}

async function runGit(
  args: string[],
  cwd: string,
  allowFailure = false
): Promise<GitCommandResult> {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_BUFFER
    });

    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString()
    };
  } catch (error: unknown) {
    const commandError = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };

    if (allowFailure) {
      return {
        stdout: commandError.stdout?.toString() ?? "",
        stderr: commandError.stderr?.toString() ?? ""
      };
    }

    const message = commandError.stderr?.toString().trim() || commandError.message || "Git command failed.";
    throw new Error(message);
  }
}

function parseNameStatus(output: string): ChangedFile[] {
  const tokens = output.split("\0");
  const files: ChangedFile[] = [];

  for (let index = 0; index < tokens.length; ) {
    const rawStatus = tokens[index++];
    if (!rawStatus) {
      continue;
    }

    const status = (rawStatus[0] ?? "M") as ChangedFile["status"];
    const firstPath = tokens[index++];
    if (!firstPath) {
      break;
    }

    if (status === "R" || status === "C") {
      const newPath = tokens[index++];
      if (newPath) {
        files.push({ path: newPath, oldPath: firstPath, status });
      }
      continue;
    }

    files.push({ path: firstPath, status });
  }

  return files;
}

function parseUntrackedFiles(output: string): ChangedFile[] {
  return output
    .split("\0")
    .filter(Boolean)
    .map((filePath) => ({ path: filePath, status: "??" as const }));
}

function countDiffLines(diff: string): ChangeStats {
  let additions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

async function getFileList(root: string, mode: ChangeMode): Promise<ChangedFile[]> {
  const diffArgs = mode === "staged" ? ["diff", "--cached"] : ["diff"];
  const result = await runGit([...diffArgs, "--name-status", "-z"], root);
  return parseNameStatus(result.stdout);
}

async function getUntrackedFiles(root: string): Promise<ChangedFile[]> {
  const result = await runGit(["ls-files", "--others", "--exclude-standard", "-z"], root);
  return parseUntrackedFiles(result.stdout);
}

async function getDiff(root: string, mode: ChangeMode, untracked: ChangedFile[]): Promise<string> {
  const diffArgs = mode === "staged" ? ["diff", "--cached"] : ["diff"];
  const trackedDiff = await runGit(
    [...diffArgs, "--no-ext-diff", "--unified=3", "--no-renames"],
    root
  );

  let diff = trackedDiff.stdout;

  // `git diff` does not include untracked files. Include a bounded no-index
  // diff so a newly created file can influence the generated subject.
  for (const file of untracked.slice(0, 20)) {
    const untrackedDiff = await runGit(
      ["diff", "--no-index", "--no-ext-diff", "--unified=0", "--", "/dev/null", path.join(root, file.path)],
      root,
      true
    );
    if (untrackedDiff.stdout) {
      diff += `${diff.endsWith("\n") || !diff ? "" : "\n"}${untrackedDiff.stdout}`;
    }
  }

  return diff;
}

export async function getGitChanges(workspacePath: string): Promise<GitChanges> {
  let rootResult: GitCommandResult;
  try {
    rootResult = await runGit(["rev-parse", "--show-toplevel"], workspacePath);
  } catch {
    throw new Error("The current workspace is not inside a Git repository.");
  }
  const repositoryRoot = rootResult.stdout.trim();
  if (!repositoryRoot) {
    throw new Error("The current workspace is not inside a Git repository.");
  }

  const stagedFiles = await getFileList(repositoryRoot, "staged");
  const mode: ChangeMode = stagedFiles.length > 0 ? "staged" : "working-tree";
  const untrackedFiles = mode === "working-tree" ? await getUntrackedFiles(repositoryRoot) : [];
  const files = mode === "staged" ? stagedFiles : [...(await getFileList(repositoryRoot, mode)), ...untrackedFiles];
  const diff = await getDiff(repositoryRoot, mode, untrackedFiles);

  return {
    repositoryRoot,
    mode,
    files,
    diff,
    stats: countDiffLines(diff)
  };
}
