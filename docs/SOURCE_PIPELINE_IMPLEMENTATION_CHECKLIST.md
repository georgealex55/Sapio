# SAPIO Source Pipeline — Prioritized Implementation Checklist

Status date: 2026-08-21  
Basis: `README.md`, `lib/source-registry.js` as the Source Registry Seed v1 proxy, and the collector/API/client implementation as the Product Architecture v1 proxy.

## Outcome

Move SAPIO from a stateless feed-snapshot prototype to a restart-safe cultural-signal pipeline:

`Sources → Raw Observations → Normalization → Exact Dedup → Near-Duplicate Clusters → Scores → Feed → Memory/Hide → Source Performance`

The immediate goal is not to add every catalog source. It is to make a small first adapter set reliable, persist the intermediate data, and make every collection run idempotent and observable.

## Current baseline

- [x] One registry for enabled open sources and a larger non-operational source catalog.
- [x] Adapter families: `rss`, `gnews`, `reddit`, `hackernews`, `pubmed`, `arxiv`, and `usgs`.
- [x] Common observation shape, URL safety checks, adult-trade text filtering, source roles, source-edge values, categories, and per-source limits.
- [x] In-run title-token clustering and score calculation.
- [x] `/api/collect` fan-out, `/api/feed` fallback behavior, image enrichment, and one Vercel Cron entry.
- [x] Optional latest-feed snapshot in Upstash/Vercel-KV-compatible REST storage.
- [x] Client-side Memory, Like, and Hide state in `localStorage`; unsaved live items disappear after 24 hours in the UI.
- [ ] Durable raw observations, stable clusters, collection history, source performance, user state, and the planned 15-minute application-managed loop.

## P0 — Required before increasing source volume

### 1. Define and validate the pipeline contracts

- [ ] Add versioned schemas for `SourceConfig`, `RawObservation`, `NormalizedObservation`, `Cluster`, `FeedItem`, `CollectionRun`, and `SourceRun`.
- [ ] Give every record `schemaVersion`, `createdAt`, and `updatedAt` fields.
- [ ] Reject or quarantine observations missing a valid title, canonical source URL, source ID, valid timestamp, categories, or source role.
- [ ] Parse dates defensively; never replace an invalid source date with “now” without recording `publishedAtInferred: true`.
- [ ] Preserve a minimal raw payload or raw-payload hash for debugging and replay.
- [ ] Add contract fixtures for RSS/Atom, Google News RSS, Reddit, Hacker News, PubMed, arXiv, and USGS.

Acceptance:

- The same normalized schema is emitted by every adapter.
- Malformed items are counted as rejected observations instead of silently appearing as fresh posts.
- A schema change can be rolled out without corrupting existing clusters.

### 2. Replace snapshot-only storage with durable pipeline persistence

- [ ] Keep `sapio:feed:latest` as the fast read model, but do not use it as the system of record.
- [ ] Persist raw/normalized observations by stable observation ID with a 30-day initial retention window.
- [ ] Persist clusters by stable cluster ID, including member observation IDs, first seen, last seen, score history, stage history, and merge history.
- [ ] Persist `CollectionRun` and per-source `SourceRun` records: start/end, latency, HTTP result, fetched/accepted/rejected counts, error class, retry count, and next eligible run.
- [ ] Persist source-performance aggregates: success rate, usable-item yield, duplicate rate, median latency, freshness, image yield, and last success.
- [ ] Add an atomic collection lock with expiry so cron, manual collection, and feed refresh cannot run the same fan-out concurrently.
- [ ] Add idempotency keys using `run bucket + sourceId`; repeated invocations must update/skip rather than duplicate.
- [ ] Separate retention policies: observations 30 days, cluster/history 180 days, collection runs 30 days, latest snapshot 30–60 minutes, user Memory until deleted.
- [ ] Make feed reads serve the most recent stale snapshot during upstream failure, with `stale`, `ageSeconds`, and `lastSuccessfulRunAt` metadata.
- [ ] Decide the production store explicitly. Recommended first path: Upstash Redis for locks, queues, snapshots, and small indexes; add Postgres before long-term observation/cluster analytics becomes large.

Acceptance:

- A deployment restart does not change cluster IDs or erase source health.
- Re-running the same source window produces zero duplicate observations.
- A failed collection cannot overwrite the last known-good feed with an empty payload.

### 3. Implement deterministic deduplication and clustering

Apply these rules in order:

- [ ] **Rule 1 — Native identity:** exact duplicate when `(sourceId, nativeItemId)` matches.
- [ ] **Rule 2 — Canonical URL:** exact duplicate when canonical URLs match after lowercasing host, removing fragments, normalizing trailing slashes/default ports, sorting retained query parameters, and removing tracking parameters (`utm_*`, `gclid`, `fbclid`, `mc_cid`, `mc_eid`, `ref`, and source-specific click IDs).
- [ ] **Rule 3 — Publisher URL resolution:** resolve Google News redirect/wrapper URLs to the publisher URL when possible; retain both `discoveryUrl` and `canonicalUrl`.
- [ ] **Rule 4 — Normalized title fingerprint:** exact/near duplicate when normalized title hashes match within a 72-hour window. Normalize Unicode, case, punctuation, whitespace, smart quotes, boilerplate publisher suffixes, and common update labels; do not remove meaningful numbers.
- [ ] **Rule 5 — Cross-source similarity:** cluster when title token similarity is at least `0.72`, or title similarity is at least `0.62` plus entity overlap is at least `0.60`.
- [ ] **Rule 6 — Safety gates:** require a compatible time window and at least one shared category/entity. Default windows: news/social 72 hours, research 30 days, product trends 14 days, USGS event identity only.
- [ ] **Rule 7 — Same-source syndication:** prevent multiple copies from one publisher from inflating breadth; breadth counts unique publisher domains, not registry entries or discovery indexes.
- [ ] **Rule 8 — Cluster merge:** merge clusters only when their representative fingerprints pass the same gates; record `mergedFrom` and never recycle IDs.
- [ ] **Rule 9 — Cluster split/review:** flag over-broad clusters when members have low pairwise similarity or conflicting named entities/categories.
- [ ] Generate stable IDs: `observationId = hash(sourceId + nativeId/canonicalUrl)` and `clusterId = UUID persisted on first creation`, not run-order values such as `c_1`.
- [ ] Store `dedupReason`, `matchedObservationId`, `similarityScores`, and algorithm version for every dedup/cluster decision.
- [ ] Build a labeled test set covering duplicate syndication, recurring topics, follow-up reporting, same headline/different event, research revisions, and identical product names.

Acceptance:

- Feed output does not contain repeated Google News/publisher versions of the same article.
- Two unrelated stories with generic shared words do not merge.
- Source breadth and evidence boosts cannot be gamed by duplicate registry entries.
- Dedup decisions can be replayed after threshold changes.

### 4. Harden the first production adapters

Implement/harden in this order:

1. **RSS/Atom** — NASA, Esquire, GQ, Men’s Health, and Glamour. It is low-auth, publisher-direct, and validates the generic normalization path.
2. **Google News RSS discovery** — broad category and named-source coverage. Treat it as discovery, resolve publisher identity/URL, and never count Google News as independent confirmation.
3. **Reddit OAuth** — first-party community/whisper signal. Replace anonymous `hot.json` access with the configured client credentials, identify the app in User-Agent, support rate-limit headers, and record subreddit/native post IDs.
4. **Hacker News** — stable native IDs and useful engagement data; use it as the reference adapter for idempotency and incremental fetches.
5. **PubMed** — evidence validation. Add NCBI identification/config, rate limiting, stable PMID identity, and publication-type/journal metadata.
6. **arXiv** — preprint validation. Persist arXiv ID/version separately so revisions update an observation instead of creating unrelated duplicates.
7. **USGS** — event evidence. Use USGS event ID only for dedup; add magnitude/region coordinates as structured fields and keep events out of semantic title clustering.

For every adapter:

- [ ] Add `enabled`, `priority`, `pollIntervalMinutes`, `timeoutMs`, `maxRetries`, `backoff`, `rateLimit`, `lookback`, and `maxItemsPerRun` config.
- [ ] Support conditional requests (`ETag`, `Last-Modified`) or cursors/high-water marks where available.
- [ ] Use bounded global and per-host concurrency rather than launching every source simultaneously.
- [ ] Classify failures as auth, rate limit, timeout, parse, upstream, policy, or validation.
- [ ] Retry only transient failures with jitter; honor `Retry-After`.
- [ ] Quarantine malformed content without failing the whole source run.
- [ ] Add adapter fixtures plus one optional live smoke test.

### 5. Make collection scheduling real and safe

- [ ] Preserve the single Vercel daily bootstrap cron required by the current Hobby plan.
- [ ] Implement the documented application-managed durable 15-minute loop, or choose an external durable scheduler/queue and update the deployment document.
- [ ] Schedule by each source’s poll interval and priority; do not fetch every registry entry every 15 minutes.
- [ ] Add a run time budget and carry unfinished sources into the next job.
- [ ] Prevent `/api/feed` from launching a full collection fan-out on a user request. It should enqueue/trigger refresh and serve the latest snapshot.
- [ ] Restrict manual `/api/collect` invocation in production even if `CRON_SECRET` is absent; fail closed.
- [ ] Add a health endpoint/report for last successful collection, snapshot age, active lock, queue depth, and unhealthy sources.

Acceptance:

- Feed traffic cannot cause a thundering herd of source requests.
- Only one collection lease is active at a time.
- High-priority sources update on schedule while slower evidence sources use longer intervals.

## P1 — Make signals trustworthy and operable

### 6. Separate discovery, confirmation, context, and evidence

- [ ] Add `publisherDomain`, `discoveredVia`, and `independentSourceGroup` to observations.
- [ ] Count independent publishers, not adapter/source-registry rows, for breadth.
- [ ] Do not let a Google News result plus the same publisher’s RSS item count as two sources.
- [ ] Require at least one independent confirmation/evidence source before promoting a cluster to `BREAKING` or `VIRAL`, except explicitly labeled raw-event feeds.
- [ ] Persist the scoring inputs and score version; recompute scores from stored observations.
- [ ] Replace the current fixed novelty formula with novelty against cluster/history fingerprints.
- [ ] Calculate velocity from observation arrival over time, not only recency plus current member count.
- [ ] Add minimum evidence rules for medical/sexual-health claims before they surface as conclusions.

### 7. Add source lifecycle and registry governance

- [ ] Move operational source values out of code into a validated config file or database-backed registry.
- [ ] Keep code-only adapter definitions separate from editable source instances.
- [ ] Add registry fields: owner, enabled environments, terms/access notes, expected cadence, locale, language, geographic scope, content policy, auth requirements, cost, and last review date.
- [ ] Add automatic circuit breaking after repeated source failures and a manual re-enable path.
- [ ] Expose catalog status as `planned`, `blocked`, `requiresAuth`, `implemented`, `degraded`, or `disabled`.
- [ ] Create a source-performance view so low-yield or duplicate-heavy sources can be demoted.

### 8. Complete config and secrets

- [ ] Remove or implement unused `YOUTUBE_API_KEY`; no YouTube adapter currently consumes it.
- [ ] Wire `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`; current Reddit adapter does not use them.
- [ ] Add `REDDIT_USER_AGENT` and, if needed, refresh-token credentials.
- [ ] Add `NCBI_API_KEY`, `NCBI_TOOL`, and `NCBI_EMAIL` for PubMed identification/rate limits.
- [ ] Add `SOURCE_REGISTRY_ENABLED_IDS` or per-environment source enablement.
- [ ] Add `COLLECTOR_MAX_CONCURRENCY`, `PER_HOST_CONCURRENCY`, `FETCH_TIMEOUT_MS`, `COLLECTION_BUDGET_MS`, and retry settings.
- [ ] Add `OBSERVATION_RETENTION_DAYS`, `CLUSTER_RETENTION_DAYS`, `SNAPSHOT_TTL_SECONDS`, and stale-feed limits.
- [ ] Add `DEDUP_ALGORITHM_VERSION`, URL/title thresholds, time windows, and tracking-parameter configuration.
- [ ] Add `SAPIO_TIMEZONE=America/Chicago` instead of duplicating timezone assumptions.
- [ ] Add logging/error-reporting configuration and a non-secret deployment/environment label.
- [ ] Validate required production variables on cold start and report configuration status without exposing secrets.

### 9. Improve image handling

- [ ] Persist source-image attribution, resolved image URL, content type, dimensions, fetch timestamp, and validation result.
- [ ] Validate image responses rather than trusting URL extensions/meta tags.
- [ ] Add per-host rate limits, cache results, and avoid refetching known failures every run.
- [ ] Preserve text-only policy through clustering so an image from another member cannot override a restricted primary item unintentionally.
- [ ] Define a licensed/fallback image policy; keep generated card art visually distinct from source media.

### 10. Add observability and replay

- [ ] Emit structured logs with `runId`, `sourceId`, `adapter`, and `clusterId`.
- [ ] Add metrics for source success, fetch latency, accepted observations, dedup ratio, cluster merges/splits, empty-category count, stale snapshot age, and image yield.
- [ ] Store failed raw payload references for bounded replay.
- [ ] Add a dry-run/replay command that normalizes, deduplicates, clusters, and scores fixtures without network calls or production writes.
- [ ] Alert when the feed is stale, a priority source repeatedly fails, category coverage is zero, or dedup ratio changes sharply.

## P2 — Product persistence and expansion

### 11. Persist user affinity safely

- [ ] Decide whether SAPIO remains anonymous/device-local or gains accounts.
- [ ] If accounts are added, persist private Memory, Likes, Hides, EROS visibility, and mode override per user; never expose public like counts.
- [ ] Add tombstones/expiry for hidden or unliked items so client storage does not grow indefinitely.
- [ ] Keep saved Memory items after feed/observation retention expires by storing a compact snapshot and canonical source link.
- [ ] Preserve the current 24-hour disappearance rule for unsaved/unliked cards as a feed policy, independent of raw-data retention.

### 12. Expand only after P0/P1 quality gates pass

- [ ] Add direct YouTube Data API adapter before calling YouTube an implemented source.
- [ ] Add Google Trends/Pinterest/TikTok-approved data sources only through supported access methods; keep news-index proxies labeled as proxies.
- [ ] Prioritize direct, structured, independently attributable sources over scraping.
- [ ] Add Reuters/AP/NPR/BBC/Nature/NOAA or other evidence/confirmation sources where access terms and feeds permit.
- [ ] Run each new source in shadow mode for at least seven days and measure usable yield, duplication, freshness, cost, and category contribution before feed promotion.

## Recommended implementation sequence

### Sprint 1 — Persistence and identity

- [ ] Schemas and fixtures.
- [ ] Stable observation/cluster IDs.
- [ ] Canonical URL and exact dedup.
- [ ] Durable observation, cluster, run, and source-run storage.
- [ ] Atomic lock and idempotency.

### Sprint 2 — First adapters and near-duplicate clustering

- [ ] Harden RSS, Google News, Reddit OAuth, and Hacker News.
- [ ] Add publisher resolution and independent-source grouping.
- [ ] Implement similarity/time/category gates and a labeled dedup test set.
- [ ] Stop `/api/feed` from running synchronous full collection.

### Sprint 3 — Evidence, scheduling, and scoring

- [ ] Harden PubMed, arXiv, and USGS.
- [ ] Implement the durable 15-minute scheduler with per-source cadence.
- [ ] Persist score history; calculate real velocity/novelty.
- [ ] Add health reporting, structured logs, and stale-feed alerts.

### Sprint 4 — Source governance and product persistence

- [ ] Registry lifecycle/status and source-performance reporting.
- [ ] Image cache/validation and attribution.
- [ ] User-state persistence decision and implementation.
- [ ] Shadow-mode onboarding for the next source group.

## Definition of done for the source-pipeline MVP

- [ ] Collection is restart-safe, idempotent, bounded, and locked.
- [ ] Raw observations and stable clusters survive deployments.
- [ ] Exact and near-duplicate rules pass a labeled regression suite.
- [ ] Feed breadth counts independent publishers correctly.
- [ ] RSS, Google News, Reddit, Hacker News, PubMed, arXiv, and USGS meet adapter contracts and expose health metrics.
- [ ] The feed endpoint never performs an unbounded synchronous fan-out.
- [ ] The 15-minute collection loop is implemented and documented.
- [ ] The last known-good feed remains available during upstream failures.
- [ ] Source performance and scoring inputs are inspectable.
- [ ] No catalog-only or proxy source is presented as a direct implemented adapter.
