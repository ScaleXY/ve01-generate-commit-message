import { CodexCommitMessageProvider, CodexProviderSettings } from "./codex";
import { LocalCommitMessageProvider } from "./local";
import { CommitMessageProvider, CommitMessageProviderId } from "../types";

export function createCommitMessageProvider(
  providerId: CommitMessageProviderId,
  codexSettings: CodexProviderSettings
): CommitMessageProvider {
  switch (providerId) {
    case "local":
      return new LocalCommitMessageProvider();
    case "codex":
    default:
      return new CodexCommitMessageProvider(codexSettings);
  }
}
