# Threads Automatic Publishing Design

Date: 2026-08-20
Status: Approved in conversation

## Goal

Add Threads as a first-class AUSSIE UMMA publishing channel. Each approved
content topic will produce a Korean multi-reply text thread and publish it
automatically to the existing `aussieumma` Threads profile after the topic's
Instagram carousel has published successfully.

## Scope

This change adds:

- a Threads-specific generated artifact;
- a publisher that creates one root post and a linear chain of replies;
- a GitHub Actions workflow with dedicated Threads credentials;
- idempotent publication logging;
- integration with the existing ship and unattended daily workflows;
- documentation for one-time Meta app and GitHub Secrets setup.

It does not add image or video Threads posts, comment-response automation,
analytics, scheduling by engagement window, or reposting of older topics.

## Content Artifact

Each topic will contain:

```text
outputs/<date>/<slug>/threads/thread.json
```

The JSON contract is:

```json
{
  "version": 1,
  "slug": "topic-slug",
  "posts": [
    { "text": "Root post" },
    { "text": "First reply" },
    { "text": "Final reply with the blog URL" }
  ],
  "sources": ["https://primary-source.example"]
}
```

Validation requires a matching slug, 5-7 non-empty posts, text within the
current Threads API limit, no duplicate posts, and at least one primary source
for factual topics. The final reply contains the published blog URL when one is
available. If no public blog URL is available, it ends with a conversational
question and omits the link.

## Editorial Structure

The generator will use the fact-checked `brief.md` and final `blog/post.md` as
its only factual inputs. It must not introduce new figures, eligibility rules,
dates, or claims.

The default sequence is:

1. A concise, conversational hook that states the practical problem or a
   useful conclusion without clickbait.
2. Three to five replies, each containing one idea.
3. A common mistake or important qualification where the topic needs one.
4. A final reply that asks a natural question and includes the blog link.

Posts use natural Korean 해요체. Numbering is optional and only used when it
improves navigation. Instagram captions are not reused verbatim.

## Generation Integration

Threads generation becomes part of the existing content-generation stage. The
responsible content agent writes `threads/thread.json` after the blog draft is
final, so it can preserve the article's corrected wording and sources. The
review gate reports the artifact, but an approved or pre-approved ship run does
not require a second Threads-specific confirmation.

Before publication, a deterministic validator checks the JSON contract and
scans every post against the final blog and brief. Exact factual statements
must be traceable to those inputs. Validation failure blocks Threads only and
does not block Naver, Blogger, or Instagram.

## Publishing Flow

`scripts/post-to-threads.mjs` will:

1. Read the requested date and optional slug.
2. Skip slugs already recorded in `outputs/<date>/threads-log.json`.
3. Validate `threads/thread.json` before making an API request.
4. Create and publish the root text post.
5. Create and publish each subsequent post as a reply to the immediately
   preceding published post, producing one linear thread.
6. Record the root post ID, all reply IDs, timestamp, slug, and status only
   after the complete chain succeeds.

The publisher will use Meta's Threads API rather than browser automation. At
implementation time, endpoint paths, text limits, token lifetime, and required
permissions will be checked again against the current official documentation:

- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/posts/
- https://developers.facebook.com/docs/threads/get-started/

Expected permissions are `threads_basic` and `threads_content_publish`, subject
to that final official-documentation verification.

## Failure Handling and Idempotency

The publisher exits non-zero for malformed artifacts, authentication errors,
API errors, or an incomplete reply chain. It prints the failing slug and reply
index without printing access tokens.

To prevent duplicate roots after a partial failure, the log stores progress
after every successful API publication using an atomic file replacement. A
retry resumes from the last confirmed post ID. A completed slug is skipped.
The log schema includes a status of `in_progress` or `published` so a partial
chain is never mistaken for a complete publication.

## Automation

A dedicated `.github/workflows/post-to-threads.yml` accepts the same `date` and
optional `slug` inputs as the Instagram workflow. It uses:

- `THREADS_ACCESS_TOKEN`
- `THREADS_USER_ID`

After Instagram succeeds, the shipping flow dispatches the Threads workflow.
The daily unattended flow does the same. The Threads workflow commits only
`outputs/*/threads-log.json`, following the existing Instagram log pattern.

Threads failure is visible as a failed workflow and is reported as a partial
channel failure. It does not undo or duplicate successful Instagram, Blogger,
or Naver publications.

## One-Time Account Setup

The setup guide will cover:

1. Add the Threads use case to the existing Meta developer app or create a
   dedicated app if the existing app cannot support it.
2. Configure the `aussieumma` Threads profile and OAuth redirect settings.
3. Authorize the required publishing permissions.
4. Exchange for the supported longer-lived user token when available.
5. Resolve the Threads user ID through the official API.
6. Store the token and user ID as GitHub repository secrets.
7. Run a read-only credential check, then a clearly identified one-topic test.

No token is stored in `config.json`, output artifacts, logs, or Git history.

## Testing

Automated tests cover:

- artifact validation and character limits;
- thread ordering and `reply_to_id` construction;
- root, reply, and publish API error handling;
- partial-progress resume without duplicate root posts;
- completed-topic skipping;
- secret redaction in errors;
- workflow argument forwarding for date and slug.

HTTP tests use mocked Meta responses. A live smoke test is run only after the
user completes OAuth setup and explicitly approves publishing the identified
test topic.

## Success Criteria

- Every shipped blog topic can produce a valid 5-7 post Korean text thread.
- A successful Instagram publication triggers Threads publication.
- The public Threads result is one root post followed by replies in order.
- Re-running a completed or partially completed job creates no duplicate root.
- Threads errors are visible and isolated from the other publishing channels.
- Every factual statement is traceable to the fact-checked brief or blog and
  its primary sources.
