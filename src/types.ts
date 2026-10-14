export type ChangeStatus = "A" | "M" | "D" | "R" | "C" | "??";
export type ChangeMode = "staged" | "working-tree";
export type CommitStyle = "conventional" | "plain";
export type CommitMessageProviderId = "codex" | "local";

export interface ChangedFile {
  path: string;
  status: ChangeStatus;
  oldPath?: string;
}

export interface ChangeStats {
  additions: number;
  deletions: number;
}

export interface GitChanges {
  repositoryRoot: string;
  mode: ChangeMode;
  files: ChangedFile[];
  diff: string;
  stats: ChangeStats;
}

export interface CommitMessageOptions {
  style?: CommitStyle;
  includeBody?: boolean;
  signal?: AbortSignal;
}

export interface CommitMessageProvider {
  readonly id: CommitMessageProviderId;
  generate(changes: GitChanges, options?: CommitMessageOptions): Promise<string>;
}
