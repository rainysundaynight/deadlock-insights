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
