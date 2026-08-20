#!/usr/bin/env node

import { createThreadsClient } from './lib/threads.mjs';

async function main() {
  const profile = await createThreadsClient({
    accessToken: process.env.THREAD_ACCESS_TOKEN,
    userId: process.env.THREAD_USER_ID,
  }).getProfile();
  if (String(profile.id) !== String(process.env.THREAD_USER_ID)) {
    throw new Error(`THREAD_USER_ID does not match authenticated profile ${profile.id}`);
  }
  console.log(`Threads authentication OK: @${profile.username} (${profile.id})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
