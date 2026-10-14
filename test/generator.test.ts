import * as assert from "node:assert/strict";
import { generateCommitMessage } from "../src/generator";
import { buildCodexArgs, buildCodexPrompt, normalizeCommitMessage } from "../src/providers/codex";
import { GitChanges } from "../src/types";

function changes(overrides: Partial<GitChanges>): GitChanges {
  return {
    repositoryRoot: "/repo",
    mode: "working-tree",
    files: [],
    diff: "",
    stats: { additions: 0, deletions: 0 },
    ...overrides
  };
}

assert.equal(
  generateCommitMessage(
    changes({
      files: [{ path: "src/auth/login.ts", status: "A" }],
      diff: "+export function login() {}\n",
      stats: { additions: 1, deletions: 0 }
    })
  ),
  "feat(auth): add authentication"
);

assert.equal(
  generateCommitMessage(
    changes({
      files: [
        { path: "src/button.test.ts", status: "M" },
        { path: "src/form.spec.ts", status: "A" }
      ],
      stats: { additions: 12, deletions: 3 }
    })
  ),
  "test: update tests"
);

assert.equal(
  generateCommitMessage(
    changes({
      files: [{ path: "README.md", status: "M" }],
      stats: { additions: 4, deletions: 1 }
    }),
    { style: "plain", includeBody: true }
  ),
  "Update documentation\n\nChanged 1 file: +4/-1.\n- M README.md"
);

const prompt = buildCodexPrompt(
  changes({
    files: [{ path: "src/auth/login.ts", status: "M" }],
    diff: "-old\n+new\n",
    stats: { additions: 1, deletions: 1 }
  }),
  { style: "conventional", includeBody: false },
  "Reference the Jira ticket from the branch name."
);

assert.match(prompt, /Additional instructions from the user:\nReference the Jira ticket from the branch name\./);
assert.match(prompt, /M src\/auth\/login\.ts/);
assert.match(prompt, /<git_diff>\n-old\n\+new\n<\/git_diff>/);
assert.match(prompt, /Return only the final commit message\./);
assert.doesNotMatch(buildCodexPrompt(changes({}), {}, "  "), /Additional instructions/);

assert.deepEqual(buildCodexArgs({ codexPath: "codex", model: "", reasoningEffort: "", fastMode: false, instructions: "" }, "/tmp/out"), [
  "exec",
  "--ephemeral",
  "--skip-git-repo-check",
  "--sandbox",
  "read-only",
  "--color",
  "never",
  "--output-last-message",
  "/tmp/out",
  "-"
]);

const argsWithModel = buildCodexArgs(
  { codexPath: "codex", model: " gpt-5.5 ", reasoningEffort: "low", fastMode: true, instructions: "" },
  "/tmp/out"
);
assert.deepEqual(argsWithModel.slice(-7), [
  "--model",
  "gpt-5.5",
  "--config",
  'model_reasoning_effort="low"',
  "--config",
  'service_tier="fast"',
  "-"
]);

assert.equal(normalizeCommitMessage("```text\nfeat(auth): update login\n```"), "feat(auth): update login");
assert.equal(normalizeCommitMessage("Commit message: fix: handle missing token"), "fix: handle missing token");

console.log("generator tests passed");
