import test from 'node:test';
import assert from 'node:assert/strict';

import { createCarouselContainer } from '../scripts/lib/instagram.mjs';

const urls = ['card-01.png', 'card-02.png', 'card-03.png'];

test('retries a transient child-container failure and preserves source order', async () => {
  const requests = [];
  let cardTwoAttempts = 0;

  const fetchImpl = async (url, options) => {
    const body = new URLSearchParams(options.body);
    requests.push({ url: String(url), body });
    if (body.get('is_carousel_item') === 'true') {
      const imageUrl = body.get('image_url');
      if (imageUrl === 'card-02.png' && cardTwoAttempts++ === 0) {
        return new Response(JSON.stringify({ error: { code: 1, message: 'transient failure' } }), { status: 400 });
      }
      return new Response(JSON.stringify({ id: `item-${imageUrl.slice(-5, -4)}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'carousel-1' }), { status: 200 });
  };

  const result = await createCarouselContainer({
    urls,
    caption: 'caption',
    userId: 'user-1',
    accessToken: 'secret-token',
  }, { fetchImpl, sleep: async () => {} });

  assert.deepEqual(result.itemIds, ['item-1', 'item-2', 'item-3']);
  assert.equal(cardTwoAttempts, 2);
  assert.equal(requests.at(-1).body.get('children'), 'item-1,item-2,item-3');
  assert.equal(result.carouselId, 'carousel-1');
});

test('aborts before carousel creation when a child container remains missing', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = new URLSearchParams(options.body);
    requests.push({ url: String(url), body });
    if (body.get('is_carousel_item') === 'true' && body.get('image_url') === 'card-02.png') {
      return new Response(JSON.stringify({ error: { code: 1, message: 'still unavailable' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ id: `item-${body.get('image_url').slice(-5, -4)}` }), { status: 200 });
  };

  await assert.rejects(
    createCarouselContainer({
      urls,
      caption: 'caption',
      userId: 'user-1',
      accessToken: 'secret-token',
    }, { fetchImpl, sleep: async () => {}, maxAttempts: 2 }),
    /1 of 3 child containers/,
  );
  assert.equal(requests.some(({ body }) => body.get('media_type') === 'CAROUSEL'), false);
});
