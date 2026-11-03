export * from './ads.core';

import { MockAdProvider } from './ads.core';

/** Web and non-Android platforms always use the safe no-op implementation. */
export const adProvider = new MockAdProvider();
