# fetch-compat report — issue #14 (card info fails on phone Safari)

Branch `fix/fetch-compat`, base 044bd46. Model: Claude Sonnet 5.5.

## Root cause (evidence level: code + reproduction by API deletion; NOT yet confirmed on the user's iPhone)
`src/data/http.ts` called `AbortSignal.any([...])` (Safari < 17.4) and `AbortSignal.timeout()` (Safari < 16) on every
request. Where missing, `get()` throws `TypeError: AbortSignal.any is not a function` before `fetch` runs. `resolveCard`
rethrows non-`ProviderError`s, so `presentSuggestion`'s `.catch` showed 「カード情報を取得できません…」 for every candidate.
- Unit RED (old code, statics stubbed away): `AssertionError: promise rejected "TypeError: AbortSignal.any is not a function"`.
- Browser RED (old code, `delete AbortSignal.any/timeout` via addInitScript): candidate never resolves (name stays empty).
- Other APIs on the card-info/price/fx path checked (`structuredClone` Safari 15.4+, `signal.throwIfAborted`/`reason` 15.4+,
  `Array.at` 15.4+, `fetch`, `Response.json`): no further gaps found. The unconfirmed part is the user's actual iOS version.

## Changes
- `src/data/http.ts`: `bound()` uses native `AbortSignal.timeout`/`any` when present (unchanged behavior); otherwise composes
  an `AbortController` + `setTimeout` + abort listener, cleaned up after each attempt. Timeout aborts with a `TimeoutError`
  DOMException. One automatic retry of the fetch call only for `TypeError` / `TimeoutError`; never for HTTP statuses
  (`ProviderError`), validation, or a caller abort.
- `src/main.ts`: failure path records `mark('card-info-error', {name, message, tcgdexId})` in the in-page log and shows a
  cause-specific message (timeout → 通信がタイムアウトしました…, network TypeError → 通信に失敗しました…, else the old generic text).
  `src/data/pokemon.ts` needed no change (it already propagates non-ProviderErrors).
- Tests: 4 new unit tests in `tests/unit/providers.test.ts`; new `tests/browser/fetch-compat.spec.ts` (2 tests, SYNTHETIC).
- Two existing browser assertions (`pokemon-flow` L65, `sticky-candidate` L27) aborted the TCGdex route (a network TypeError) and
  asserted the old generic text; they now assert the new, more specific 「通信に失敗しました」. Same behavior checked (message shown,
  panel hidden), but this is an assertion change — coordinator review requested.

## Verification
- `npm run check`: 30 files / 259 tests pass. `npm run build`: OK.
- Playwright, 1 worker, port 4246 (desktop + mobile-viewport): fetch-compat 4/4, pokemon-flow 36/36, sticky-candidate 6/6, live-candidate 34/34.
  (First run of pokemon-flow/sticky had the 2×2 failures above before the assertion update.) Full suite NOT run.
- WebKit: no WebKit project in `playwright.config.ts` and `--browser` is rejected with projects defined. Ran ad hoc with a
  temporary config (deleted, not committed) using the installed webkit-2272: fetch-compat 2/2 pass.
  Note: WebKit renders the yen sign as `¥`, not `￥`; existing `pokemon-flow` price assertions would fail there (pre-existing,
  unrelated), so the new test accepts either.

## Limits
- Desktop WebKit with deleted statics emulates the API gap; it is not iPhone Safari. Human device test: NOT RUN.
- Mocked fixtures prove the code path, not TCGdex behavior on the phone. If the phone still fails after this, the new
  `card-info-error` log entry (名前/メッセージ/tcgdexId) in 端末内の計測ログ will show the real cause.
