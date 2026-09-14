const API = 'https://graph.facebook.com/v21.0';
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 2_000;
const NON_RETRYABLE_ERROR_CODES = new Set([10, 190, 200, 294]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRetry(data) {
  const code = Number(data?.error?.code);
  return !NON_RETRYABLE_ERROR_CODES.has(code);
}

export async function createCarouselContainer({ urls, caption, userId, accessToken }, {
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('at least one carousel URL is required');

  const itemIds = [];
  for (const imageUrl of urls) {
    let data = {};
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const body = new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: 'true',
        access_token: accessToken,
      });
      const response = await fetchImpl(`${API}/${userId}/media`, { method: 'POST', body });
      data = await response.json();
      if (data.id) break;
      if (!shouldRetry(data) || attempt === maxAttempts) break;
      await sleep(RETRY_INTERVAL_MS);
    }
    if (!data.id) {
      throw new Error(`child container failed: ${itemIds.length} of ${urls.length} child containers created`);
    }
    itemIds.push(data.id);
  }

  if (itemIds.length !== urls.length) {
    throw new Error(`child container count mismatch: ${itemIds.length} of ${urls.length} child containers created`);
  }

  const carouselBody = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: itemIds.join(','),
    caption,
    access_token: accessToken,
  });
  const carouselResponse = await fetchImpl(`${API}/${userId}/media`, { method: 'POST', body: carouselBody });
  const carousel = await carouselResponse.json();
  if (!carousel.id) throw new Error('carousel container failed');

  return { itemIds, carouselId: carousel.id };
}
