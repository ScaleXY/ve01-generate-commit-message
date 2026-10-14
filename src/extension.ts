import * as vscode from "vscode";
import * as path from "node:path";
import { getGitChanges } from "./git";
import { createCommitMessageProvider } from "./providers";
import { listCodexModels } from "./providers/codex";
import { CommitMessageProviderId, CommitStyle } from "./types";

interface GitRepository {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
}

interface GitApi {
  repositories: readonly GitRepository[];
}

interface GitExtension {
  getAPI(version: 1): GitApi;
}

function pathsMatch(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function setGitCommitInput(repositoryRoot: string, message: string): Promise<boolean> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!gitExtension) {
    return false;
  }

  const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
  const api = git?.getAPI(1);
  const repository = api?.repositories.find((candidate) =>
    pathsMatch(candidate.rootUri.fsPath, repositoryRoot)
  );

  if (!repository) {
    return false;
  }

  repository.inputBox.value = message;
  return true;
}

interface ModelQuickPickItem extends vscode.QuickPickItem {
  value?: string;
  custom?: boolean;
}

function getConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("commitMessageGenerator");
}

async function selectModel(): Promise<void> {
  const configuration = getConfiguration();
  const current = configuration.get<string>("model", "").trim();
  const models = await listCodexModels();

  const items: ModelQuickPickItem[] = [
    {
      label: "Codex default",
      description: current ? undefined : "current",
      detail: "Use the model configured in your Codex config.toml.",
      value: ""
    },
    ...models.map((model) => ({
      label: model.displayName,
      description: model.slug === current ? `${model.slug} · current` : model.slug,
      detail: [model.description, model.supportsFastMode ? "Supports fast mode." : undefined]
        .filter(Boolean)
        .join(" "),
      value: model.slug
    })),
    {
      label: "$(edit) Enter a model name...",
      custom: true
    }
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Commit Message Generator: Codex Model",
    placeHolder: models.length > 0 ? "Select the model Codex uses" : "No cached Codex models found; enter one manually",
    matchOnDescription: true,
    matchOnDetail: true
  });
  if (!picked) {
    return;
  }

  let model = picked.value;
  if (picked.custom) {
    model = await vscode.window.showInputBox({
      title: "Commit Message Generator: Codex Model",
      prompt: "Enter a model name accepted by `codex exec --model`. Leave blank to use the Codex default.",
      value: current
    });
    if (model === undefined) {
      return;
    }
  }

  await configuration.update("model", model?.trim() ?? "", vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    model?.trim() ? `Commit messages will use ${model.trim()}.` : "Commit messages will use the Codex default model."
  );
}

async function toggleFastMode(): Promise<void> {
  const configuration = getConfiguration();
  const enabled = !configuration.get<boolean>("fastMode", false);
  await configuration.update("fastMode", enabled, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    enabled
      ? "Fast mode is on. Codex responds faster but uses more of your usage limit."
      : "Fast mode is off."
  );
}

async function generateCommitMessage(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Open a Git workspace before generating a commit message.");
    return;
  }

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating commit message...",
        cancellable: true
      },
      async (_progress, token) => {
        const changes = await getGitChanges(workspaceFolder.uri.fsPath);
        if (changes.files.length === 0) {
          throw new Error("No staged, unstaged, or untracked changes were found.");
        }

        const configuration = getConfiguration();
        const provider = createCommitMessageProvider(configuration.get<CommitMessageProviderId>("provider", "codex"), {
          codexPath: configuration.get<string>("codexPath", ""),
          model: configuration.get<string>("model", ""),
          reasoningEffort: configuration.get<string>("reasoningEffort", ""),
          fastMode: configuration.get<boolean>("fastMode", false),
          instructions: configuration.get<string>("instructions", "")
        });

        const abortController = new AbortController();
        const cancellation = token.onCancellationRequested(() => abortController.abort());
        try {
          return {
            message: await provider.generate(changes, {
              style: configuration.get<CommitStyle>("style", "conventional"),
              includeBody: configuration.get<boolean>("includeBody", true),
              signal: abortController.signal
            }),
            repositoryRoot: changes.repositoryRoot
          };
        } finally {
          cancellation.dispose();
        }
      }
    );

    const subject = result.message.split("\n", 1)[0];
    const placedInInput = await setGitCommitInput(result.repositoryRoot, result.message);
    if (placedInInput) {
      vscode.window.showInformationMessage(`Generated commit message: ${subject}`);
    } else {
      await vscode.env.clipboard.writeText(result.message);
      vscode.window.showWarningMessage(
        `Git's commit input was unavailable. The generated message was copied instead: ${subject}`
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to generate a commit message.";
    vscode.window.showErrorMessage(message);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commitMessageGenerator.generate", generateCommitMessage),
    vscode.commands.registerCommand("commitMessageGenerator.selectModel", selectModel),
    vscode.commands.registerCommand("commitMessageGenerator.toggleFastMode", toggleFastMode),
    vscode.commands.registerCommand("commitMessageGenerator.editInstructions", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "commitMessageGenerator.instructions")
    )
  );
}

export function deactivate(): void {
  // Nothing to clean up; command disposables are owned by the extension context.
}
