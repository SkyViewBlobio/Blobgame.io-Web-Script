import assert from 'node:assert/strict';
import test from 'node:test';

import { BackgroundFeature } from '../src/features/BackgroundFeature.js';
import { createFakeDocument } from './helpers/fake-dom.js';

test('BackgroundFeature injects background CSS and applies page classes', () => {
  const document = createFakeDocument();
  const feature = new BackgroundFeature({
    document,
    backgroundUrl: 'data:image/png;base64,test-image',
  });

  assert.equal(feature.start(), true);

  const style = document.getElementById('blobio-background-style');
  assert.notEqual(style, null);
  assert.match(style.textContent, /data:image\/png;base64,test-image/);
  assert.equal(document.documentElement.classList.contains('blobio-background-enabled'), true);
  assert.equal(document.body.classList.contains('blobio-background-enabled'), true);

  feature.destroy();

  assert.equal(document.getElementById('blobio-background-style'), null);
  assert.equal(document.documentElement.classList.contains('blobio-background-enabled'), false);
  assert.equal(document.body.classList.contains('blobio-background-enabled'), false);
});

test('BackgroundFeature does not create duplicate styles when started twice', () => {
  const document = createFakeDocument();
  const feature = new BackgroundFeature({
    document,
    backgroundUrl: 'data:image/png;base64,test-image',
  });

  feature.start();
  feature.start();

  assert.equal(document.querySelectorAll('#blobio-background-style').length, 1);

  feature.destroy();
});
