# Changelog

## 0.1.2

- Add a `commitMessageGenerator.fastMode` setting and a **Toggle Fast Mode** command to use Codex's faster service tier. The model picker shows which models support it.
- Improve message quality: send Codex the diff with surrounding context and ask for specific, imperative subjects that are typed by behavior rather than file names.
- Include a body explaining what changed and why by default (`commitMessageGenerator.includeBody` now defaults to `true`).
- Find a working Codex CLI automatically: if `codex` on PATH is broken or missing, try common install locations such as `/opt/homebrew/bin`. `commitMessageGenerator.codexPath` now defaults to blank.
- Show the actual Codex error instead of the tail of a stack trace.
- Add an extension icon.

## 0.1.0

- Generate commit messages with the locally installed Codex CLI (`codex exec`), replacing the bundled ACP adapter.
- Add the `commitMessageGenerator.model` setting and a **Select Codex Model** command.
- Add the `commitMessageGenerator.instructions` setting for custom prompt instructions.
- Add the `commitMessageGenerator.codexPath` setting.
- Allow cancelling a running generation.

## 0.0.1

- Initial release.
