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
  "format": "question",
  "posts": [
    { "text": "Root post" },
    { "text": "Optional supporting reply" }
  ],
  "sources": ["https://primary-source.example"]
}
```

Validation requires a matching slug, an allowed format, 1-3 non-empty posts,
text within the current Threads API limit, no duplicate posts, and at least one
primary source for factual topics. A blog link is optional and appears only in
the last reply when it genuinely adds value.

## Editorial Structure

The generator will use the fact-checked `brief.md` and final `blog/post.md` as
its only factual inputs. It must not introduce new figures, eligibility rules,
dates, or claims.

Threads content rotates among four formats so the account does not read like a
single repeated marketing template:

1. **Question (`question`)** — sounds like a Korean mum in Australia asking
   other parents about a real decision or uncertainty. The root contains the
   full question and normally stands alone so audience replies form the
   thread. One factual context reply is allowed when needed.
2. **Information (`information`)** — opens with the useful conclusion, then
   adds one or two short replies for context, a caveat, or an official source.
   It does not turn the blog into a numbered summary. It introduces why the
   fact matters in everyday life, then explains it as something recently
   learned: natural forms such as `~한대`, `~라고 해`, and
   `~인 줄 알았는데` are preferred over report-like phrases such as
   `공식 자료에 따르면` or `안내하고 있습니다`. Institution names and source
   links belong in the final supporting reply when needed, not in the opening.
3. **Experience (`experience`)** — tells a genuine first-person moment,
   surprise, mistake, or lesson. This format is allowed only when the user has
   supplied the underlying experience or it is explicitly recorded as an
   approved brand fact. The generator must never invent a child age, visa
   history, family event, purchase, or personal outcome.
4. **Observation (`observation`)** — replaces experience when no verified
   personal story exists. It describes something commonly noticed in
   Australian parenting life without pretending the account owner experienced
   it personally.

The generator checks recently published Threads formats and selects the least
recently used suitable format. Suitability wins over strict rotation: a legal
or benefit correction should remain informational, while an open-ended
childcare or swimming topic may be a question.

The writing should resemble a natural Threads post: direct opening such as
`스친들아`, short spoken sentences, intentional line breaks, and one concrete
thought per post. It avoids blog titles, headings, summaries, numbered
`1/5` sequences, mandatory calls to action, repeated hashtags, and a question
artificially added to every post. It also avoids `ㅎㅎ`, which does not match
the desired contemporary voice. Instagram captions are not reused verbatim.

Most topics publish one root post. Supporting self-replies are limited to one
or two and used only when the additional context would make the root too long
or confusing. Conversation is expected to grow through reader replies, not a
mandatory chain written by the account itself.

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
5. When supporting posts exist, create and publish each as a reply to the
   immediately preceding post.
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

- Every shipped blog topic can produce a valid natural Korean Threads artifact
  using a suitable rotating format.
- A successful Instagram publication triggers Threads publication.
- The public Threads result is one root post followed by replies in order.
- Re-running a completed or partially completed job creates no duplicate root.
- Threads errors are visible and isolated from the other publishing channels.
- Every factual statement is traceable to the fact-checked brief or blog and
  its primary sources.
