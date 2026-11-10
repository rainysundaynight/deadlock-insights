<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Deadlock data is fetched client-side from https://api.deadlock-api.com via `src/lib/api.ts` + TanStack Query (API allows CORS, no key); shared UI helpers live in `src/components/dl.tsx`.
- Live per-player match stats stream via browser EventSource from `/v1/matches/demo/live/query` (SQL over the broadcast, quoted camelCase columns) in `src/lib/liveStream.ts`; it's opt-in per click because spectating is rate-limited per IP.
- App layout is a left sidebar shell (`AppShell` in `src/components/SiteHeader.tsx`); add new pages to its NAV groups.
- Sidebar navigation uses a shrinkable, vertical-only `.sidebar-scroll` region with hidden scrollbar tracks; keep branding outside it so classic scrollbars never alter menu width.
- Scope touch idle-pose hiding to containers with an alternate pose; heroes without alternate artwork must stay visible on touch devices.
- Match dossier comparisons use direction-aware competition ranks and midrank percentiles via `matchMetrics`; keep raw mean deltas neutral and survival based on deaths, not damage exposure.
- Hero mastery uses aggregate player hero stats rather than limited recent history, with explicit joint experience/winrate gates from `MASTERY_REQUIREMENTS`; DNA presentation converts ratios to deviations without changing archetype inputs.
- Theme all pages through global semantic CSS tokens and shared Gazette motion primitives; keep chart history based on real minute-poll samples so the live list never consumes additional spectating connections.
- Use shared ruled Radix tab rails for section navigation; each block has one motion owner so nested reveal and layout animations never compete.
- Resolve profile match artwork through matchHeroPose with normal-portrait fallback; outcome poses are present without hover so touch users see the same result.
- Stat's opt-in game variant scopes angled labels and accent rails to player summaries without changing shared statistics elsewhere.
- Use HeroFigure for unframed dossier artwork and TeamIdentity for Gazette team insignia; stable art footprints and shared identity prevent overlapping mobile content and inconsistent team headers.
- Profile artwork uses an intrinsic-ratio, resolution-capped image with edge masks on the image itself, not its larger container, so baked-in card crops fade without enlarging low-resolution art.
- Steam sign-in is Steam OpenID 2.0 via `/api/public/steam/login` → `/api/public/steam/callback` (verifies with Steam, admin-creates a user with a synthetic email, returns a magic-link token_hash that `/auth/steam` exchanges with verifyOtp; popup+postMessage in iframes). Cloud has no native Steam provider.
- User data (profiles, followed_players, goals) lives in Lovable Cloud with own-row RLS; friend match alerts are client-side polling of `/v1/matches/active` in `FriendNotifier` (only while the site is open).
- Match coach notes are pure rules in `src/lib/coach.ts` with tests so advice stays deterministic and verifiable.
- CollectibleCard owns pointer tilt and foil via motion values, separate from list layout; touch/reduced-motion stay static and share-card export uses the untransformed PNG preview.
