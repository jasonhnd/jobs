/**
 * Path for the no-occupation 9-question entry.
 *
 * Owner lock 2026-08-17: `/shindan` stays as that entry. `/me` is
 * occupation-first. A later #236 public-name change (including any 転職
 * claim) is still one edit plus a redirect from this constant.
 *
 * The retired alias `/me/start` 301s here — see
 * `noOccAliasRedirectTarget` in `src/lib/shindan-share-route.ts`.
 */
export const NO_OCC_PATH = '/shindan';

/** Public path shipped briefly by #259 before the owner pointed the branch at `/shindan`. */
export const NO_OCC_ALIAS_PATH = '/me/start';
