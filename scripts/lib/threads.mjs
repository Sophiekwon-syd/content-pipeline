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
