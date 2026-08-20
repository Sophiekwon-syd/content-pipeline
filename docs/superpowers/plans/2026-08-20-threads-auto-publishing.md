# Threads Automatic Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate natural Korean Threads artifacts in rotating editorial formats and automatically publish them to `aussieumma` after a successful Instagram publication.

**Architecture:** A focused Threads library validates artifacts and publishes resumable root/reply chains through Meta's API. A dedicated Threads writer agent creates `thread.json` after the blog is final, while a reusable GitHub workflow handles credentials, publication, and log commits. The Instagram workflow calls that workflow only after its own posting job succeeds.

**Tech Stack:** Node.js 20 ESM, built-in `node:test`, Meta Threads API, GitHub Actions, existing Markdown/JSON content pipeline

**Spec:** `docs/superpowers/specs/2026-08-20-threads-auto-publishing-design.md`

## Global Constraints

- Threads artifacts contain 1-3 posts and use `question`, `information`, `experience`, or `observation` format.
- Root posts use the single `호주육아` Threads topic through API metadata; do not repeat it as hashtag text.
- Never invent personal experiences, child ages, visa histories, family events, purchases, or outcomes.
- Threads copy must not contain `ㅎㅎ`, blog headings, numbered `1/5` sequences, repeated hashtags, or mandatory calls to action.
- Factual claims must come only from the fact-checked brief or final blog and retain primary-source URLs.
- Threads failure must not undo or duplicate Instagram, Blogger, or Naver publication.
- Never write access tokens to config, artifacts, logs, errors, or Git history.
- Re-running a partial publication must resume without creating another root post.

## File Map

- Create `scripts/lib/threads.mjs`: artifact schema, editorial validation, log helpers, API client, and resumable publishing service.
- Create `scripts/post-to-threads.mjs`: date/slug CLI and filesystem orchestration.
- Create `scripts/check-threads-auth.mjs`: read-only credential check.
- Create `tests/threads.test.mjs`: validator, API sequencing, redaction, resume, and skip tests.
- Create `.agents/agents/threads-writer.md`: Threads generation prompt and format rotation rules.
- Modify `.agents/skills/generate-content/SKILL.md`: add Threads generation and review reporting.
- Modify `.agents/skills/ship-topic/SKILL.md`: add artifact verification, commit/push, and Threads workflow dispatch behavior.
- Modify `scripts/daily-ship.sh`: require Threads generation and automatic publication in unattended runs.
- Create `.github/workflows/post-to-threads.yml`: reusable/manual Threads publishing workflow.
- Modify `.github/workflows/post-to-instagram.yml`: invoke Threads workflow after Instagram success.
- Create `docs/threads-setup.md`: Meta app, OAuth, secrets, checks, and first live test.

---

### Task 1: Artifact Validation and Progress Model

**Files:**
- Create: `scripts/lib/threads.mjs`
- Create: `tests/threads.test.mjs`

**Interfaces:**
- Produces: `validateThreadArtifact(value, { brief, post }) -> { version, slug, format, topic_tag, posts, sources }`
- Produces: `nextThreadFormat(recentFormats, allowedFormats) -> string`
- Produces: `readThreadsLog(path) -> Promise<Array<ThreadLogEntry>>`
- Produces: `writeThreadsLog(path, entries) -> Promise<void>` using atomic rename
- `ThreadLogEntry`: `{ slug, status, rootId, postIds, nextIndex, publishedAt?, format }`

- [ ] **Step 1: Write failing artifact-validation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateThreadArtifact, nextThreadFormat } from '../scripts/lib/threads.mjs';

test('accepts a natural question artifact', () => {
  const value = {
    version: 1,
    slug: 'swimming-lessons',
    format: 'question',
    topic_tag: '호주육아',
    posts: [{ text: '스친들아 아이 수영수업은 언제 시작했어?' }],
    sources: [],
  };
  assert.equal(validateThreadArtifact(value, { brief: '', post: '' }).format, 'question');
});

test('rejects banned voice and excessive self replies', () => {
  const value = {
    version: 1,
    slug: 'x',
    format: 'information',
    posts: Array.from({ length: 4 }, (_, i) => ({ text: `${i + 1}/4 정보ㅎㅎ` })),
    sources: ['https://www.healthdirect.gov.au/example'],
  };
  assert.throws(() => validateThreadArtifact(value, { brief: '정보', post: '정보' }), /1-3|ㅎㅎ|numbered/i);
});

test('rotates to the least recently used suitable format', () => {
  assert.equal(nextThreadFormat(['question', 'information'], ['question', 'information', 'observation']), 'observation');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/threads.test.mjs`

Expected: FAIL because `scripts/lib/threads.mjs` does not exist.

- [ ] **Step 3: Implement strict validation and format rotation**

Implement constants and exports:

```js
export const THREAD_FORMATS = ['question', 'information', 'experience', 'observation'];
export const MAX_POSTS = 3;

export function nextThreadFormat(recent, allowed = THREAD_FORMATS) {
  return allowed.find((format) => !recent.slice(-allowed.length).includes(format))
    || allowed.find((format) => format !== recent.at(-1))
    || allowed[0];
}
```

`validateThreadArtifact` must default `topic_tag` to `호주육아` and reject
multiple or unsupported topic tags. It must also reject unknown keys that affect publishing,
missing fields, invalid URLs, posts outside 1-3, duplicate text, empty text,
text beyond the API limit confirmed from official docs, `ㅎㅎ`, hashtags,
`N/N` numbering, and unsupported formats. For information artifacts, require a
primary-source URL and require every numeric/date token in Threads text to
appear in `brief` or `post`. For experience artifacts, require an
`experience_verified: true` field set by the writer only when its source input
explicitly contains a user-provided first-person account.

- [ ] **Step 4: Implement atomic progress-log helpers and tests**

Write to `${path}.tmp`, then `rename` it to `path`. Tests use a temporary
directory from `fs.mkdtemp` and assert round-trip preservation of
`in_progress` and `published` entries.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `node --test tests/threads.test.mjs`

Expected: all validation, rotation, and log tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/threads.mjs tests/threads.test.mjs
git commit -m "feat: validate Threads content artifacts"
```

### Task 2: Threads Writer and Pipeline Generation

**Files:**
- Create: `.agents/agents/threads-writer.md`
- Modify: `.agents/skills/generate-content/SKILL.md`

**Interfaces:**
- Consumes: final `brief.md`, final `blog/post.md`, recent published formats from `outputs/*/threads-log.json`, and the Threads voice rules in the spec.
- Produces: `outputs/<date>/<slug>/threads/thread.json` matching Task 1.

- [ ] **Step 1: Add a failing fixture test for generated examples**

Add a table-driven test to `tests/threads.test.mjs` that loads four fixtures
from `tests/fixtures/threads/` and validates one example per format. Include
these exact behavioral assertions:

```js
assert.doesNotMatch(allText, /ㅎㅎ|\b\d+\/\d+\b|#호주/);
assert.ok(artifact.posts.length >= 1 && artifact.posts.length <= 3);
if (artifact.format === 'experience') assert.equal(artifact.experience_verified, true);
```

Expected: FAIL because fixtures and writer contract do not exist.

- [ ] **Step 2: Write the Threads writer agent instructions**

The agent must:

- read the brief and final blog only, with no independent research;
- select the least recently used suitable format;
- use a complete conversational root post;
- add 0-2 self replies only when needed;
- use `~한대`, `~라고 해`, or `~인 줄 알았는데` naturally for information posts;
- keep source links out of the opening and place them in a supporting reply;
- never use `ㅎㅎ`;
- never fabricate personal experience;
- emit JSON only to the required path;
- run `validateThreadArtifact` before reporting completion.

Add four valid fixture artifacts that demonstrate the approved question,
information, verified-experience, and observation formats without presenting
the fixture's hypothetical experience as production account history.

- [ ] **Step 3: Integrate the writer after blog generation**

Update `generate-content/SKILL.md` so Threads generation starts only after
`blog/post.md` is final. Add Threads to the review summary and define partial
success: a Threads generation failure does not block blog, carousel, or video.

- [ ] **Step 4: Run tests and static checks**

Run: `node --test tests/threads.test.mjs`

Run: `rg -n 'ㅎㅎ|5-7|3-5 replies' .agents/agents/threads-writer.md .agents/skills/generate-content/SKILL.md tests/fixtures/threads`

Expected: tests pass; `rg` returns no matches.

- [ ] **Step 5: Commit**

```bash
git add .agents/agents/threads-writer.md .agents/skills/generate-content/SKILL.md tests/fixtures/threads tests/threads.test.mjs
git commit -m "feat: generate conversational Threads drafts"
```

### Task 3: Resumable Threads API Publisher

**Files:**
- Modify: `scripts/lib/threads.mjs`
- Create: `scripts/post-to-threads.mjs`
- Modify: `tests/threads.test.mjs`

**Interfaces:**
- Produces: `createThreadsClient({ token, userId, fetchImpl, apiBase })`
- Produces: `publishArtifact({ artifact, logEntry, client, onProgress }) -> Promise<ThreadLogEntry>`
- CLI: `node scripts/post-to-threads.mjs [--date YYYY-MM-DD] [--slug slug] [--dry-run]`

- [ ] **Step 1: Confirm the live API contract from Meta primary documentation**

Verify the API base, current version, text limit, token lifetime, permissions,
text-container creation fields, publishing endpoint, reply field, and official
topic-tag field from:

- `https://developers.facebook.com/docs/threads/get-started/`
- `https://developers.facebook.com/docs/threads/posts/`

Record the verified values as named constants and comments in
`scripts/lib/threads.mjs`. If Meta's current reply API cannot create self-reply
chains, stop and revise the design instead of substituting browser automation.

- [ ] **Step 2: Write failing API-sequence and resume tests**

Use a mocked `fetchImpl` to assert this sequence:

```text
POST /{userId}/threads          root container
POST /{userId}/threads_publish root publish
POST /{userId}/threads          reply container with reply_to_id=<rootId>
POST /{userId}/threads_publish reply publish
```

Add a partial-failure test where the root is already logged and only reply
index 1 is sent. Assert no second root-container request occurs. Add a test
that API error strings redact both the raw token and URL-encoded token.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/threads.test.mjs --test-name-pattern='publish|resume|redact'`

Expected: FAIL because publisher exports do not exist.

- [ ] **Step 4: Implement the API client and resumable service**

Create containers with `media_type=TEXT`, `text`, `topic_tag` on the root when
supported by the verified API, and `reply_to_id` when applicable, then publish
each returned creation ID. Call `onProgress` after
every published post with `{ status: 'in_progress', rootId, postIds,
nextIndex }`; return `status: 'published'` only after all posts finish.
Normalize API errors to include status, Meta error code, and post index while
redacting secrets.

- [ ] **Step 5: Implement the filesystem CLI**

The CLI reads date/slug, finds artifacts, validates each against its brief and
blog, skips published logs, resumes partial logs, and atomically persists every
progress callback. `--dry-run` validates and prints format/post counts without
network calls or requiring secrets. Missing artifacts are clean skips; invalid
artifacts and attempted-but-failed publications make the command exit 1.

- [ ] **Step 6: Run full tests and a local dry run**

Run: `node --test tests/threads.test.mjs`

Run: `node scripts/post-to-threads.mjs --date 2026-08-18 --dry-run`

Expected: tests pass; existing topics without Threads artifacts are reported
as clean skips and no log is written.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/threads.mjs scripts/post-to-threads.mjs tests/threads.test.mjs
git commit -m "feat: publish resumable Threads conversations"
```

### Task 4: Credential Check and GitHub Workflow

**Files:**
- Create: `scripts/check-threads-auth.mjs`
- Create: `.github/workflows/post-to-threads.yml`
- Modify: `.github/workflows/post-to-instagram.yml`
- Modify: `tests/threads.test.mjs`

**Interfaces:**
- Auth CLI consumes `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`; performs one read-only identity request.
- Reusable workflow accepts string inputs `date` and `slug` and secrets with the same names.

- [ ] **Step 1: Write failing workflow and auth-contract tests**

Add tests that read both YAML files and assert:

```js
assert.match(threadsWorkflow, /workflow_call/);
assert.match(threadsWorkflow, /THREADS_ACCESS_TOKEN/);
assert.match(instagramWorkflow, /needs:\s*post/);
assert.match(instagramWorkflow, /post-to-threads\.yml/);
```

Add a mocked auth test that expects `GET /me?fields=id,username` and verifies
that a mismatched returned ID exits unsuccessfully without exposing the token.

- [ ] **Step 2: Implement the read-only credential checker**

Reuse `createThreadsClient`; print only the verified username and user ID.
Missing secrets, permission errors, and ID mismatches exit 1.

- [ ] **Step 3: Add the reusable/manual Threads workflow**

Support both `workflow_dispatch` and `workflow_call`. Checkout, install Node,
run the publisher with safe shell argument construction, then pull/rebase and
force-add only `outputs/*/threads-log.json` before committing. Set
`permissions.contents: write` and a 10-minute timeout.

- [ ] **Step 4: Chain Threads after Instagram**

Add a second job to `post-to-instagram.yml` with `needs: post` that invokes the
local reusable Threads workflow and forwards `date`, `slug`, and the two
Threads repository secrets. Do not use `if: always()`; Instagram failure must
prevent automatic Threads publication.

- [ ] **Step 5: Verify tests and workflow syntax**

Run: `node --test tests/threads.test.mjs`

Run: `ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f, aliases: true) }; puts "workflow yaml ok"' .github/workflows/post-to-instagram.yml .github/workflows/post-to-threads.yml`

Expected: tests pass and output is `workflow yaml ok`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-threads-auth.mjs .github/workflows/post-to-threads.yml .github/workflows/post-to-instagram.yml tests/threads.test.mjs
git commit -m "ci: publish Threads after Instagram"
```

### Task 5: Ship Integration and Account Setup Guide

**Files:**
- Modify: `.agents/skills/ship-topic/SKILL.md`
- Modify: `scripts/daily-ship.sh`
- Create: `docs/threads-setup.md`

**Interfaces:**
- Consumes: Task 2 artifact and Task 4 workflow.
- Produces: operator instructions for setup, normal ship, unattended ship, and failure recovery.

- [ ] **Step 1: Update ship-topic generation and verification**

Require the Threads writer after the blog is final. Verify `thread.json` with
the publisher's `--dry-run`, report format and post count at the review gate,
commit/push the artifact before channel publishing, and report Threads as a
separate partial-success channel.

- [ ] **Step 2: Update unattended daily shipping**

Amend the prompt in `daily-ship.sh` to generate and validate Threads content.
Do not dispatch Threads separately from the shell; the Instagram workflow's
successful completion triggers it.

- [ ] **Step 3: Write the one-time setup guide**

Document exact Meta dashboard navigation based on the current official UI,
required permissions, redirect URI, token exchange/renewal, user-ID lookup,
GitHub secret commands, read-only credential check, and first live test. Use
placeholders only for user-owned secret values, never example real tokens.
Include these commands:

```bash
gh secret set THREADS_ACCESS_TOKEN
gh secret set THREADS_USER_ID
THREADS_ACCESS_TOKEN='…' THREADS_USER_ID='…' node scripts/check-threads-auth.mjs
gh workflow run post-to-threads.yml -f date=YYYY-MM-DD -f slug=topic-slug
```

The live smoke-test section must require explicit approval of the named topic
because it creates a public post.

- [ ] **Step 4: Verify documentation consistency**

Run: `rg -n '5-7|3-5 replies|ㅎㅎ|THREADS_ACCESS_TOKEN|THREADS_USER_ID' docs/threads-setup.md .agents/skills/ship-topic/SKILL.md scripts/daily-ship.sh`

Expected: no old reply-count or `ㅎㅎ` matches; credential names appear in the
setup guide and automation instructions.

- [ ] **Step 5: Commit**

```bash
git add .agents/skills/ship-topic/SKILL.md scripts/daily-ship.sh docs/threads-setup.md
git commit -m "docs: integrate Threads into shipping"
```

### Task 6: End-to-End Verification Without Publishing

**Files:**
- Modify only if verification reveals a defect in files from Tasks 1-5.

**Interfaces:**
- Verifies the complete feature contract; produces no public post.

- [ ] **Step 1: Run all automated tests**

Run: `node --test tests/threads.test.mjs`

Expected: zero failures.

- [ ] **Step 2: Generate one local sample artifact through the writer instructions**

Use an existing fact-checked topic, write its artifact under `/tmp` rather than
`outputs`, and validate it through the exported validator. Confirm the selected
format follows recent-format rotation and contains no invented experience.

- [ ] **Step 3: Run secret and style scans**

Run: `rg -n 'THREADS_ACCESS_TOKEN\s*[:=]\s*[^$]|th_[A-Za-z0-9]{20,}' . --glob '!node_modules/**' --glob '!.git/**'`

Run: `rg -n 'ㅎㅎ|\b[1-9]/[1-9]\b' .agents/agents/threads-writer.md tests/fixtures/threads`

Expected: no embedded token values and no banned Threads voice patterns.

- [ ] **Step 4: Verify repository state and review the diff**

Run: `git diff --check`

Run: `git status --short`

Run: `git log --oneline --max-count=8`

Expected: no whitespace errors; only known unrelated user-owned untracked files
remain; all implementation commits are present.

- [ ] **Step 5: Stop at the live-publication gate**

Report that code and read-only checks are complete. Ask the user to complete
the Meta OAuth steps and approve one named topic before running the first live
Threads smoke test. Do not publish a placeholder or generic test post.
