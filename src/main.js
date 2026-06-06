import backgroundUrl from '../background.png';
import { BackgroundFeature } from './features/BackgroundFeature.js';

const INSTANCE_KEY = '__blobioExtension';

class BlobioExtension {
  constructor(windowRef = globalThis) {
    this.window = windowRef;
    this.features = [];
    this.started = false;
  }

  start() {
    if (this.started) {
      return true;
    }

    const document = this.window.document;
    if (!document?.documentElement) {
      this.window.console?.warn('[Blobio] Extension could not start: document is not ready.');
      return false;
    }

    this.features = [
      new BackgroundFeature({
        document,
        backgroundUrl,
        logger: this.window.console || console,
      }),
    ];

    for (const feature of this.features) {
      feature.start();
    }

    this.started = true;
    return true;
  }

  destroy() {
    for (let index = this.features.length - 1; index >= 0; index -= 1) {
      this.features[index].destroy();
    }

    this.features = [];
    this.started = false;
  }
}

export function startBlobioExtension(windowRef = globalThis) {
  if (windowRef[INSTANCE_KEY]) {
    return windowRef[INSTANCE_KEY];
  }

  const extension = new BlobioExtension(windowRef);
  windowRef[INSTANCE_KEY] = extension;
  extension.start();
  return extension;
}

startBlobioExtension(globalThis);
