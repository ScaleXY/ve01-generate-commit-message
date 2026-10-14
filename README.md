# Commit Message Generator

Generate a commit message from your Git changes with one click, using the [Codex CLI](https://github.com/openai/codex) already installed on your machine.

## Requirements

- [Codex CLI](https://github.com/openai/codex) installed and signed in (`codex login`).
- A workspace inside a Git repository.

## Usage

1. Stage the changes you want to commit. If nothing is staged, the extension uses unstaged and untracked changes instead.
2. Click the sparkle button in the Source Control title bar, or run **Commit Message Generator: Generate Commit Message** from the Command Palette.
3. Review the generated message in the commit input, then commit.

You can cancel a running generation from its progress notification.

## Settings

| Setting | Description |
| --- | --- |
| `commitMessageGenerator.model` | Model passed to `codex exec --model`. Leave blank to use your Codex default. Run **Commit Message Generator: Select Codex Model** to pick from the models available to your account. |
| `commitMessageGenerator.instructions` | Extra instructions added to the prompt, for example "Keep the subject under 50 characters". Open them with **Commit Message Generator: Edit Instructions**. |
| `commitMessageGenerator.style` | `conventional` (`feat(scope): summary`) or `plain`. |
| `commitMessageGenerator.includeBody` | Add a body explaining what changed and why below the subject line (on by default). |
| `commitMessageGenerator.fastMode` | Use Codex fast mode for quicker responses, at a higher cost against your usage limit. Toggle it with **Commit Message Generator: Toggle Fast Mode**. |
| `commitMessageGenerator.reasoningEffort` | Reasoning effort for Codex. Leave as default to use your Codex config. |
| `commitMessageGenerator.provider` | `codex` (default) or `local`, which uses offline heuristics and sends nothing anywhere. |
| `commitMessageGenerator.codexPath` | Path to the `codex` executable. Leave blank to find a working one automatically. |

## Privacy

With the `codex` provider, the changed file names and diff are sent to the model through your Codex CLI, under your Codex account and configuration. Codex runs in a read-only sandbox and the session is not saved. Use the `local` provider if your changes must stay on your machine.

## Development

```bash
npm install
npm test
```

Press `F5` in VS Code to launch an Extension Development Host. Run `npm run package` to build a `.vsix`.

## License

MIT. See the `LICENSE` file.
