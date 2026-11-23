# Contents View keyword history

Apply `20261120152842_archive_popular_keyword_versions.sql` before deploying the
history list. It does not change the current published rankings.

Each changed save archives the previous ordered array with its effective start
and end timestamps. A save with identical keywords in the same order does not
create another snapshot. Reordering is a change. The first snapshot is recorded
on the first changed save after installation; older overwritten lists cannot be
recovered by this migration. No retention job or fixed collection interval is set.

Each changed save also rebuilds and stores the full calculated Contents View
ranking for that Asia/Seoul date in `public.contents_view_keyword_daily_rankings`.
Rank changes compare the new cumulative ranking with the same day's cumulative
ranking before that save. A first appearance in the visible top 50 is marked new.
The live list refreshes every 30 seconds. It reserves the latest registration
positions for new entries, then fills the remaining spots through rank 50
in cumulative order without changing points or stored ranks.
Historical dates show the top 50 from the corresponding saved daily ranking.
Each submitted round still accepts up to 20 terms. Rank 1 receives 20 points
and rank 20 receives 1 point. Ties use appearances, best rank, then keyword.
Google still uses its existing saved rank snapshots and shows a daily top 20.

Apply `20261121013000_archive_google_trend_rank_snapshots.sql` to separately
retain Google's Korean (KR) snapshots by collection time, including the full
keyword-to-rank map. It backfills Korean snapshots that still exist and mirrors
future Korean snapshot writes without following the 48-hour cleanup. There is no
automatic deletion from the archive. Existing collection timing and public
date queries are unchanged; the archive only grows when a snapshot is written.

For later analysis, flatten each archived snapshot without renumbering its ranks:

```sql
select h.id as snapshot_id, h.valid_from, h.valid_until,
       k.position as rank, k.keyword
from public.hero_search_keyword_history h
cross join lateral unnest(h.keywords) with ordinality as k(keyword, position)
order by h.id desc, k.position;
```
