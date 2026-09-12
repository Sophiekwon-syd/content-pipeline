import fs from 'node:fs/promises';
import path from 'node:path';

export const THREAD_FORMATS = ['question', 'information', 'experience', 'observation'];
export const MAX_POSTS = 3;
export const MAX_TEXT_LENGTH = 500;
export const DEFAULT_TOPIC_TAG = '호주육아';

const fail = (message) => { throw new Error(`Invalid Threads artifact: ${message}`); };

export function nextThreadFormat(recent, allowed = THREAD_FORMATS) {
  const valid = allowed.filter((format) => THREAD_FORMATS.includes(format));
  if (!valid.length) fail('no allowed formats');
  const window = recent.slice(-valid.length);
  return valid.find((format) => !window.includes(format))
    || valid.find((format) => format !== recent.at(-1))
    || valid[0];
}

export function validateThreadArtifact(value, { brief = '', post = '' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('root must be an object');
  if (value.version !== 1) fail('version must be 1');
  if (typeof value.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) fail('invalid slug');
  if (!THREAD_FORMATS.includes(value.format)) fail('unsupported format');
  if (value.topic_tag != null && value.topic_tag !== DEFAULT_TOPIC_TAG) fail(`unsupported topic_tag: ${value.topic_tag}`);
  if (!Array.isArray(value.posts) || value.posts.length < 1 || value.posts.length > MAX_POSTS) fail('posts must contain 1-3 items');
  if (!Array.isArray(value.sources)) fail('sources must be an array');
  for (const source of value.sources) {
    try {
      const url = new URL(source);
      if (url.protocol !== 'https:') fail(`source must use https: ${source}`);
    } catch {
      fail(`invalid source URL: ${source}`);
    }
  }
  if (value.format === 'experience' && value.experience_verified !== true) fail('experience_verified must be true');
  if (value.format === 'information' && value.sources.length === 0) fail('information format requires a primary source');

  const seen = new Set();
  const posts = value.posts.map((item, index) => {
    if (!item || typeof item.text !== 'string') fail(`post ${index + 1} text is required`);
    const text = item.text.trim();
    const length = [...text].length;
    if (!text) fail(`post ${index + 1} is empty`);
    if (length > MAX_TEXT_LENGTH) fail(`post ${index + 1} exceeds ${MAX_TEXT_LENGTH} characters`);
    if (seen.has(text)) fail(`post ${index + 1} duplicates another post`);
    if (/ㅎㅎ/.test(text)) fail('ㅎㅎ is not allowed');
    if (/\b\d+\/\d+\b/.test(text)) fail('numbered N/N sequences are not allowed');
    if (/(?:^|\s)#[\p{L}\p{N}_]+/u.test(text)) fail('hashtag text is not allowed; use topic_tag');
    seen.add(text);
    return { text };
  });

  if (value.format === 'information') {
    const sourceText = `${brief}\n${post}`;
    const numbers = posts.flatMap(({ text }) => text.match(/\d+(?:[.,]\d+)*/g) || []);
    for (const number of numbers) {
      if (!sourceText.includes(number)) fail(`numeric claim ${number} is not traceable to brief or post`);
    }
  }

  return {
    version: 1,
    slug: value.slug,
    format: value.format,
    ...(value.experience_verified === true ? { experience_verified: true } : {}),
    topic_tag: value.topic_tag || DEFAULT_TOPIC_TAG,
    posts,
    sources: [...value.sources],
  };
}

export async function readThreadsLog(logPath) {
  try {
    const value = JSON.parse(await fs.readFile(logPath, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function writeThreadsLog(logPath, entries) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const tempPath = `${logPath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tempPath, logPath);
}

function redact(value, secret) {
  return String(value).split(secret).join('[REDACTED]');
}

export function createThreadsClient({
  accessToken,
  userId,
  fetch: fetchImpl = globalThis.fetch,
  apiBase = 'https://graph.threads.net/v1.0',
}) {
  if (!accessToken) throw new Error('THREAD_ACCESS_TOKEN is required');
  if (!userId) throw new Error('THREAD_USER_ID is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  const formatApiError = (body, status) => {
    const error = body?.error;
    const detail = error?.message || error || `HTTP ${status}`;
    const metadata = [
      error?.code != null ? `code=${error.code}` : null,
      error?.error_subcode != null ? `subcode=${error.error_subcode}` : null,
      error?.type ? `type=${error.type}` : null,
      error?.fbtrace_id ? `fbtrace_id=${error.fbtrace_id}` : null,
    ].filter(Boolean).join(', ');
    return redact(`${detail}${metadata ? ` (${metadata})` : ''}`, accessToken);
  };

  const request = async (pathname, params) => {
    const url = new URL(`${apiBase}/me/${pathname}`);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok || !body.id) {
      throw new Error(`Threads API POST /me/${pathname} failed: ${formatApiError(body, response.status)}`);
    }
    return body.id;
  };

  const getContainerStatus = async (containerId) => {
    const url = new URL(`${apiBase}/${encodeURIComponent(containerId)}`);
    url.searchParams.set('fields', 'id,status,error_message');
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok || !body.id || !body.status) {
      throw new Error(`Threads API GET /{container_id}?fields=id,status,error_message failed: ${formatApiError(body, response.status)}`);
    }
    return {
      ...body,
      error_message: body.error_message == null ? body.error_message : redact(body.error_message, accessToken),
    };
  };

  const getProfile = async () => {
    const url = new URL(`${apiBase}/me`);
    url.searchParams.set('fields', 'id,username');
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok || !body.id) {
      throw new Error(`Threads API GET /me failed: ${formatApiError(body, response.status)}`);
    }
    return { id: body.id, username: body.username };
  };

  return {
    getProfile,
    getContainerStatus,
    createTextContainer({ text, topicTag, replyToId }) {
      return request('threads', {
        media_type: 'TEXT',
        text,
        topic_tag: topicTag,
        reply_to_id: replyToId,
      });
    },
    publishContainer(creationId) {
      return request('threads_publish', { creation_id: creationId });
    },
  };
}

export async function waitUntilReady(client, containerId, {
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxAttempts = 12,
  intervalMs = 5000,
} = {}) {
  let lastStatus = 'UNKNOWN';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await client.getContainerStatus(containerId);
    lastStatus = status.status;
    if (status.status === 'FINISHED') return status;
    if (status.status === 'ERROR' || status.status === 'EXPIRED') {
      const detail = status.error_message ? `: ${status.error_message}` : '';
      throw new Error(`Threads publish readiness failed for container ${containerId}: status=${status.status}${detail}`);
    }
    if (status.status === 'PUBLISHED') {
      throw new Error(`Threads publish readiness failed for container ${containerId}: status=PUBLISHED; refusing duplicate publish`);
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error(`Threads publish readiness timed out for container ${containerId}: status=${lastStatus}, checks=${maxAttempts}`);
}

export async function publishThreadArtifact(artifact, {
  client,
  progress = {},
  onProgress = async () => {},
  sleep,
  maxAttempts,
  intervalMs,
} = {}) {
  if (!client) throw new Error('Threads client is required');
  const state = {
    status: progress.status || 'in_progress',
    rootId: progress.rootId,
    postIds: [...(progress.postIds || [])],
    nextIndex: progress.nextIndex || 0,
  };

  for (let index = state.nextIndex; index < artifact.posts.length; index += 1) {
    const isRoot = index === 0;
    const containerId = await client.createTextContainer({
      text: artifact.posts[index].text,
      topicTag: isRoot ? artifact.topic_tag : undefined,
      replyToId: isRoot ? undefined : state.rootId,
    });
    await waitUntilReady(client, containerId, { sleep, maxAttempts, intervalMs });
    const postId = await client.publishContainer(containerId);
    if (isRoot) state.rootId = postId;
    state.postIds.push(postId);
    state.nextIndex = index + 1;
    await onProgress({ ...state, postIds: [...state.postIds] });
  }

  state.status = 'published';
  await onProgress({ ...state, postIds: [...state.postIds] });
  return state;
}
