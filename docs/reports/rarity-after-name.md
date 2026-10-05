# Rarity after the card name (follow-up to #12)

Branch `feat/rarity-after-name`, base 92f4373. Agent: Claude Sonnet 5.5. Request: 「レアリティはカード名の後ろに表示するようにして」.

## Change
- `src/main.ts`: new `rarityNodes(view)` (same `.rarity-badge`, aria-label/title 「レアリティ SR」, nothing when rarity is null). The candidate name is now wrapped in `.name-line` (`strong.candidate-name` + badge); `showCard` rebuilds it, so dock, detail sheet, picked alternatives and the history-opened sheet share it. `metaNodes` no longer emits the rarity (regulation mark and 番号で照合 unchanged). 他の候補 rows also use `.name-line` (name + badge).
- `src/ui/style.css`: `.name-line` flex row; name `flex:0 1 auto;min-width:0`, badge `flex:none`. Dock keeps the 2-line clamp on the name (selector extended to `.name-line>strong`); the detail sheet lets the name wrap. The name shrinks/ellipsizes before the badge, so the badge stays on screen.
- Tests: `printed-rarity.spec.ts` (position + 320/390px long-name cases + alternatives rows); `pokemon-synthetic.ts` gets a SYNTHETIC `longName` option.

## TDD (real runs)
- RED (old build, new spec): printed-rarity 8 failed / 4 passed (desktop+mobile) — badge was in `.meta`, not after `.candidate-name`; alternatives rows had no badge; long-name cases failed on badge position.
- GREEN: `npm run check` 28 files / 243 tests pass; `npm run build` ok.
- Playwright, 1 worker each (desktop + mobile-viewport): printed-rarity 12, pokemon-flow 36, collapsed-dock 6, alternatives-products 12, scan-history 10, camera-first-design 4 — all passed. Full suite NOT run.

## Real check (Chromium 390x844, `vite preview` :4193, upload /tmp/ubbg_665887.jpg)
M2a 216/193 ハイパーボール: name line 「ハイパーボール [SR]」; meta row 「[I] 番号で照合」. Screenshots: `rarity-after-name-dock.png`, `rarity-after-name-detail.png`.
`rarity-after-name-320.png`: 320px, real card with the rendered name overwritten by a SYNTHETIC long name; name clamps with an ellipsis, badge fully visible (x 278–308 of 320), no horizontal overflow.

## Limits
- Fixtures are SYNTHETIC; no live camera, no iPhone Safari (NOT RUN).
- 他の候補 rows did not show rarity before; they now do (per the request's list). History list rows still show no rarity (they never did); the history-opened sheet does.
- The 320px screenshot's long name is synthetic text injected into the DOM, not a real card name.
