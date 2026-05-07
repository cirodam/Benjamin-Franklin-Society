<script lang="ts">
    import { getCommunityLog, type ActivityLogEntry, type ActivityLogType } from "../lib/api.js";

    let entries  = $state<ActivityLogEntry[]>([]);
    let loading  = $state(true);
    let error    = $state("");
    let loadingMore = $state(false);
    let exhausted   = $state(false);

    const PAGE = 50;

    async function load() {
        loading = true; error = "";
        try {
            entries = await getCommunityLog({ limit: PAGE });
            exhausted = entries.length < PAGE;
        } catch (e) { error = (e as Error).message; }
        finally { loading = false; }
    }

    async function loadMore() {
        if (loadingMore || exhausted || entries.length === 0) return;
        loadingMore = true;
        try {
            const before = entries[entries.length - 1]!.occurredAt;
            const next = await getCommunityLog({ limit: PAGE, before });
            entries = [...entries, ...next];
            exhausted = next.length < PAGE;
        } catch { /* silent */ }
        finally { loadingMore = false; }
    }

    $effect(() => { load(); });

    // ── Helpers ──────────────────────────────────────────────────────────────

    type LogGroup = { date: string; entries: ActivityLogEntry[] };

    function groupByDate(items: ActivityLogEntry[]): LogGroup[] {
        const map = new Map<string, ActivityLogEntry[]>();
        for (const e of items) {
            const d = e.occurredAt.slice(0, 10);
            if (!map.has(d)) map.set(d, []);
            map.get(d)!.push(e);
        }
        return Array.from(map.entries()).map(([date, ents]) => ({ date, entries: ents }));
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }

    function formatTime(iso: string): string {
        return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }

    const ICON: Record<ActivityLogType, string> = {
        "motion-passed":       "✓",
        "motion-failed":       "✗",
        "motion-withdrawn":    "↩",
        "member-joined":       "→",
        "member-discharged":   "←",
        "demurrage-run":       "⊙",
        "dues-collected":      "⊙",
        "constitution-amended":"§",
        "annual-issuance":     "↑",
        "pool-created":        "+",
        "assembly-drawn":      "⚖",
        "bylaw-created":       "📕",
        "bylaw-amended":       "✏",
        "bylaw-expired":       "⌛",
        "role-type-added":     "👤",
        "role-type-removed":   "✂",
        "unit-type-added":     "🏗",
        "unit-type-removed":   "✂",
        "unit-deployed":       "🏢",
        "marketplace-founded": "🏪",
    };

    const COLOR: Record<ActivityLogType, string> = {
        "motion-passed":       "green",
        "motion-failed":       "red",
        "motion-withdrawn":    "gray",
        "member-joined":       "blue",
        "member-discharged":   "gray",
        "demurrage-run":       "amber",
        "dues-collected":      "amber",
        "constitution-amended":"purple",
        "annual-issuance":     "blue",
        "pool-created":        "green",
        "assembly-drawn":      "purple",
        "bylaw-created":       "blue",
        "bylaw-amended":       "blue",
        "bylaw-expired":       "amber",
        "role-type-added":     "green",
        "role-type-removed":   "red",
        "unit-type-added":     "green",
        "unit-type-removed":   "red",
        "unit-deployed":       "green",
        "marketplace-founded": "green",
    };
</script>

<div class="page">
    <header class="page-header">
        <h1 class="page-title">Community Timeline</h1>
        <p class="page-subtitle">A public record of all significant community events.</p>
    </header>

    {#if loading}
        <p class="state-msg">Loading…</p>
    {:else if error}
        <p class="state-msg error">{error}</p>
    {:else if entries.length === 0}
        <p class="state-msg muted">No events recorded yet.</p>
    {:else}
        <div class="timeline">
            {#each groupByDate(entries) as group (group.date)}
                <div class="day-group">
                    <h2 class="day-label">{formatDate(group.date)}</h2>
                    <ul class="day-entries">
                        {#each group.entries as entry (entry.id)}
                            <li class="entry entry--{COLOR[entry.type] ?? 'gray'}">
                                <span class="entry-icon">{ICON[entry.type] ?? "·"}</span>
                                <span class="entry-body">
                                    <span class="entry-summary">{entry.summary}</span>
                                    <span class="entry-time">{formatTime(entry.occurredAt)}</span>
                                </span>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        {#if !exhausted}
            <div class="load-more-row">
                <button class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load older events"}
                </button>
            </div>
        {:else}
            <p class="state-msg muted" style="margin-top:1.5rem;">— End of record —</p>
        {/if}
    {/if}
</div>

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem 4rem;
    }

    .page-header { margin-bottom: 1.5rem; }

    .page-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.25rem;
    }

    .page-subtitle {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
    }

    .state-msg {
        text-align: center;
        font-size: 0.9rem;
        color: #64748b;
        padding: 2rem 0;
        margin: 0;
    }
    .state-msg.error  { color: #dc2626; }
    .state-msg.muted  { color: #94a3b8; }

    /* ── Timeline ──────────────────────────────────────────────────────────── */
    .timeline { display: flex; flex-direction: column; gap: 1.5rem; }

    .day-group {}

    .day-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 0 0 0.5rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid #f1f5f9;
    }

    .day-entries {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .entry {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.55rem 0.75rem;
        border-radius: 0.5rem;
        background: #f8fafc;
        border-left: 3px solid #e2e8f0;
    }

    .entry--green  { border-left-color: #16a34a; background: #f0fdf4; }
    .entry--red    { border-left-color: #dc2626; background: #fef2f2; }
    .entry--blue   { border-left-color: #2563eb; background: #eff6ff; }
    .entry--amber  { border-left-color: #d97706; background: #fffbeb; }
    .entry--purple { border-left-color: #7c3aed; background: #f5f3ff; }
    .entry--gray   { border-left-color: #94a3b8; background: #f8fafc; }

    .entry-icon {
        font-size: 0.9rem;
        line-height: 1.4;
        min-width: 1rem;
        text-align: center;
        flex-shrink: 0;
    }

    .entry-body {
        display: flex;
        flex: 1;
        flex-direction: row;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .entry-summary {
        font-size: 0.875rem;
        color: #1e293b;
        line-height: 1.4;
    }

    .entry-time {
        font-size: 0.75rem;
        color: #94a3b8;
        white-space: nowrap;
        flex-shrink: 0;
    }

    /* ── Load more ─────────────────────────────────────────────────────────── */
    .load-more-row {
        display: flex;
        justify-content: center;
        margin-top: 1.5rem;
    }

    .load-more-btn {
        padding: 0.55rem 1.25rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        background: #fff;
        font-size: 0.875rem;
        color: #334155;
        cursor: pointer;
    }

    .load-more-btn:hover:not(:disabled) { background: #f1f5f9; }
    .load-more-btn:disabled { opacity: 0.5; cursor: default; }
</style>
