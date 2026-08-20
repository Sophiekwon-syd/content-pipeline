# Threads automatic publishing

Threads publishing uses Meta's Threads API and the `aussieumma` Threads profile.

## GitHub secrets

Add these repository secrets under **Settings → Secrets and variables → Actions**:

- `THREAD_ACCESS_TOKEN`: a Threads user access token
- `THREAD_USER_ID`: the Threads profile ID returned by the Threads API

The Meta app needs these permissions:

- `threads_basic`
- `threads_content_publish`
- `threads_manage_replies` only when publishing artifacts containing self-replies

Do not reuse `IG_ACCESS_TOKEN` or `IG_USER_ID`. Threads uses its own API host,
OAuth token, user ID, and app permissions.

## Artifact

Each topic may include `outputs/<date>/<slug>/threads/thread.json`. The artifact
contains one to three posts, one `topic_tag` (`호주육아`), sources, and an
editorial format: `question`, `information`, `experience`, or `observation`.

Experience posts require `experience_verified: true`. Information posts require
source URLs and all numeric claims must appear in the shared brief or blog post.

Validate without publishing:

```bash
node scripts/post-to-threads.mjs \
  --date 2026-07-24 \
  --slug messy-play-castle-hill \
  --dry-run
```

## Publishing

Run the **Post to Threads** GitHub workflow with a date and slug. The workflow:

1. checks the authenticated profile;
2. validates the artifact;
3. publishes the root and any self-replies;
4. commits `outputs/<date>/threads-log.json` so reruns skip completed posts and
   interrupted reply chains resume without recreating the root.

The Instagram workflow also calls the Threads workflow after a successful
Instagram job when both date and slug were supplied.

For local testing, export the two environment variables and run:

```bash
node scripts/check-threads-auth.mjs
node scripts/post-to-threads.mjs --date <YYYY-MM-DD> --slug <topic-slug>
```

Never print or commit the access token. API errors redact the token before they
are written to logs.

Official API reference: Meta's Threads API collection on Postman.
