import { generateCommitMessage } from "../generator";
import { CommitMessageOptions, CommitMessageProvider, GitChanges } from "../types";

export class LocalCommitMessageProvider implements CommitMessageProvider {
  readonly id = "local" as const;

  async generate(changes: GitChanges, options: CommitMessageOptions = {}): Promise<string> {
    return generateCommitMessage(changes, options);
  }
}
