import { ChangedFile, CommitMessageOptions, GitChanges } from "./types";

const IGNORED_SCOPE_SEGMENTS = new Set([
  "src",
  "lib",
  "app",
  "apps",
  "packages",
  "test",
  "tests",
  "spec",
  "__tests__",
  "components"
]);

function isTestFile(filePath: string): boolean {
  return /(^|[/\\])(__tests__|tests?|spec)([/\\]|$)|\.(test|spec)\.[^.]+$/i.test(filePath);
}

function isDocumentationFile(filePath: string): boolean {
  return /(^|[/\\])(docs?|documentation)([/\\]|$)|\.(md|mdx|txt)$/i.test(filePath);
}

function isConfigFile(filePath: string): boolean {
  return /(^|[/\\])(?:\.github|\.vscode|config|configs)([/\\]|$)|(?:^|[/\\])(?:dockerfile|makefile|[^/\\]*\.(?:json|ya?ml|yaml|toml|ini|env))$/i.test(
    filePath
  );
}

function isDependencyFile(filePath: string): boolean {
  return /(^|[/\\])(?:package(?:-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|requirements\.txt|poetry\.lock|go\.sum)$/i.test(
    filePath
  );
}

function isStyleFile(filePath: string): boolean {
  return /\.(css|scss|sass|less|styl)$/i.test(filePath);
}

function hasStatus(files: ChangedFile[], status: ChangedFile["status"]): boolean {
  return files.some((file) => file.status === status);
}

function allMatch(files: ChangedFile[], predicate: (filePath: string) => boolean): boolean {
  return files.length > 0 && files.every((file) => predicate(file.path));
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function pathWithoutExtension(filePath: string): string {
  const baseName = filePath.split(/[\\/]/).pop() ?? filePath;
  return baseName.replace(/\.[^.]+$/, "");
}

function inferScope(files: ChangedFile[]): string | undefined {
  const directories = files.map((file) => {
    const parts = file.path.split(/[\\/]/);
    parts.pop();
    return parts.filter((part) => !IGNORED_SCOPE_SEGMENTS.has(part.toLowerCase()));
  });

  if (directories.length === 0) {
    return undefined;
  }

  const common: string[] = [];
  for (let index = 0; ; index += 1) {
    const candidate = directories[0][index];
    if (!candidate || !directories.every((directory) => directory[index] === candidate)) {
      break;
    }
    common.push(candidate);
  }

  const scope = common.at(-1);
  if (!scope || [".", ".."].includes(scope)) {
    return undefined;
  }

  return humanize(scope).replace(/\s+/g, "-");
}

function inferTarget(files: ChangedFile[]): string {
  const allPaths = files.map((file) => file.path).join(" ").toLowerCase();

  const hints: Array<[RegExp, string]> = [
    [/auth|login|log-in|sign-in|signup|sign-up|session|password/, "authentication"],
    [/api|endpoint|route|client/, "API integration"],
    [/component|jsx|tsx|ui|view|screen/, "UI components"],
    [/schema|migration|model|database|db/, "data model"],
    [/style|css|scss|theme/, "styling"],
    [/test|spec/, "tests"],
    [/readme|docs?|documentation/, "documentation"],
    [/depend|package|lock/, "dependencies"],
    [/config|setting|env|docker|workflow/, "configuration"]
  ];

  for (const [pattern, target] of hints) {
    if (pattern.test(allPaths)) {
      return target;
    }
  }

  if (files.length === 1) {
    const name = humanize(pathWithoutExtension(files[0].path));
    if (name && name !== "index") {
      return name;
    }

    const parent = files[0].path.split(/[\\/]/).slice(-2, -1)[0];
    if (parent && !IGNORED_SCOPE_SEGMENTS.has(parent.toLowerCase())) {
      return humanize(parent);
    }
  }

  const scope = inferScope(files);
  return scope ? `${scope} changes` : "project changes";
}

function inferType(changes: GitChanges): string {
  const { files, diff } = changes;

  if (allMatch(files, isTestFile)) {
    return "test";
  }
  if (allMatch(files, isDocumentationFile)) {
    return "docs";
  }
  if (allMatch(files, isDependencyFile)) {
    return "build";
  }
  if (allMatch(files, isConfigFile)) {
    return "chore";
  }
  if (allMatch(files, isStyleFile)) {
    return "style";
  }
  if (/\b(?:fix|fixed|bug|hotfix|regression|crash)\b/i.test(diff)) {
    return "fix";
  }
  if (hasStatus(files, "A") || hasStatus(files, "??")) {
    return "feat";
  }
  return "refactor";
}

function inferVerb(files: ChangedFile[]): string {
  if (files.length > 0 && files.every((file) => file.status === "A" || file.status === "??")) {
    return "add";
  }
  if (files.length > 0 && files.every((file) => file.status === "D")) {
    return "remove";
  }
  if (files.length > 0 && files.every((file) => file.status === "R")) {
    return "rename";
  }
  return "update";
}

function buildSubject(changes: GitChanges): string {
  return `${inferVerb(changes.files)} ${inferTarget(changes.files)}`;
}

function buildBody(changes: GitChanges): string {
  const fileCount = changes.files.length;
  const fileWord = fileCount === 1 ? "file" : "files";
  const summary = `Changed ${fileCount} ${fileWord}: +${changes.stats.additions}/-${changes.stats.deletions}.`;
  const fileLines = changes.files
    .slice(0, 8)
    .map((file) => {
      const status = file.status === "??" ? "A" : file.status;
      const rename = file.oldPath ? ` (from ${file.oldPath})` : "";
      return `- ${status} ${file.path}${rename}`;
    });

  if (changes.files.length > fileLines.length) {
    fileLines.push(`- ...and ${changes.files.length - fileLines.length} more`);
  }

  return `${summary}\n${fileLines.join("\n")}`;
}

export function generateCommitMessage(changes: GitChanges, options: CommitMessageOptions = {}): string {
  const style = options.style ?? "conventional";
  const subject = buildSubject(changes);
  const type = inferType(changes);
  const scope = inferScope(changes.files);
  const header = style === "plain" ? capitalize(subject) : `${type}${scope ? `(${scope})` : ""}: ${subject}`;

  return options.includeBody ? `${header}\n\n${buildBody(changes)}` : header;
}
