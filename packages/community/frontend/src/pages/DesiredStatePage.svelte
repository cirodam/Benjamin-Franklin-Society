<script lang="ts">
    import { getDesiredState } from "../lib/api.js";
    import type { DesiredStateDto } from "../lib/api.js";

    let data: DesiredStateDto | null = $state(null);
    let loading = $state(true);
    let error   = $state("");

    async function load() {
        loading = true; error = "";
        try { data = await getDesiredState(); }
        catch (e) { error = e instanceof Error ? e.message : "Failed to load"; }
        finally { loading = false; }
    }

    $effect(() => { load(); });

    // Build a quick lookup: poolId → pool name
    const poolName = $derived(
        data ? new Map(data.pools.map(p => [p.id, p.name])) : new Map<string, string>()
    );

    // Build a quick lookup: domainId → domain name (from desired state)
    const domainName = $derived(
        data ? new Map(data.domains.map(d => [d.id, d.name])) : new Map<string, string>()
    );

    // Group units by domainId
    const unitsByDomain = $derived(() => {
        if (!data) return new Map<string, typeof data.units>();
        const m = new Map<string, typeof data.units>();
        for (const u of data.units) {
            if (!m.has(u.domainId)) m.set(u.domainId, []);
            m.get(u.domainId)!.push(u);
        }
        return m;
    });

    // Group links by poolId
    const linksByPool = $derived(() => {
        if (!data) return new Map<string, typeof data.links>();
        const m = new Map<string, typeof data.links>();
        for (const l of data.links) {
            if (!m.has(l.poolId)) m.set(l.poolId, []);
            m.get(l.poolId)!.push(l);
        }
        return m;
    });
</script>

<div class="page">
    <div class="page-header">
        <div>
            <h1 class="page-title">Desired State</h1>
            <p class="page-subtitle">Structural declarations parsed from governing documents. Green = already in DB. Yellow = pending (would be created on next boot).</p>
        </div>
        <button class="refresh-btn" onclick={load} disabled={loading} aria-label="Refresh">↻</button>
    </div>

    {#if error}
        <div class="error-banner">{error}</div>
    {/if}

    {#if loading && !data}
        <div class="loading">Loading…</div>

    {:else if data}

        <!-- ── Domains ──────────────────────────────────────────────────── -->
        <section class="section">
            <div class="section-header">
                <span class="section-title">Functional Domains</span>
                <span class="count">{data.domains.length}</span>
            </div>
            <div class="card-list">
                {#each data.domains as d}
                    <div class="card" class:exists={d.exists} class:pending={!d.exists}>
                        <div class="card-row">
                            <span class="card-name">{d.name}</span>
                            <span class="status-badge" class:badge-ok={d.exists} class:badge-pending={!d.exists}>
                                {d.exists ? "exists" : "pending"}
                            </span>
                        </div>
                        <div class="card-meta">
                            <code class="id">{d.id}</code>
                            <span class="sep">·</span>
                            <span class="source">§ {d.docId} {d.sectionId}</span>
                        </div>
                        {#if data && unitsByDomain()?.get(d.id)?.length}
                            <div class="sub-list">
                                {#each unitsByDomain()!.get(d.id)! as u}
                                    <div class="sub-item">
                                        <span class="sub-name">{u.name}</span>
                                        <code class="unit-type">{u.unitType}</code>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
                {#if data.domains.length === 0}
                    <div class="empty">No domain.define directives found in any document.</div>
                {/if}
            </div>
        </section>

        <!-- ── Leader Pools ────────────────────────────────────────────── -->
        <section class="section">
            <div class="section-header">
                <span class="section-title">Leader Pools</span>
                <span class="count">{data.pools.length}</span>
            </div>
            <div class="card-list">
                {#each data.pools as p}
                    <div class="card" class:exists={p.exists} class:pending={!p.exists}>
                        <div class="card-row">
                            <span class="card-name">{p.name}</span>
                            <span class="status-badge" class:badge-ok={p.exists} class:badge-pending={!p.exists}>
                                {p.exists ? "exists" : "pending"}
                            </span>
                        </div>
                        <div class="card-meta">
                            <code class="id">{p.id}</code>
                            <span class="sep">·</span>
                            <span class="source">§ {p.docId} {p.sectionId}</span>
                        </div>
                        {#if p.mandate}
                            <div class="mandate">{p.mandate}</div>
                        {/if}
                        {#if data && linksByPool()?.get(p.id)?.length}
                            <div class="governs-list">
                                <span class="governs-label">Governs:</span>
                                {#each linksByPool()!.get(p.id)! as l}
                                    <span class="governs-tag">{domainName.get(l.domainId) ?? l.domainId}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
                {#if data.pools.length === 0}
                    <div class="empty">No pool.define directives found in any document.</div>
                {/if}
            </div>
        </section>

        <!-- ── Summary ────────────────────────────────────────────────── -->
        <section class="section summary-section">
            <div class="summary-grid">
                <div class="summary-cell">
                    <div class="summary-val">{data.domains.filter(d => d.exists).length}/{data.domains.length}</div>
                    <div class="summary-label">Domains reconciled</div>
                </div>
                <div class="summary-cell">
                    <div class="summary-val">{data.units.length}</div>
                    <div class="summary-label">Units declared</div>
                </div>
                <div class="summary-cell">
                    <div class="summary-val">{data.pools.filter(p => p.exists).length}/{data.pools.length}</div>
                    <div class="summary-label">Pools reconciled</div>
                </div>
                <div class="summary-cell">
                    <div class="summary-val">{data.links.length}</div>
                    <div class="summary-label">Pool-domain links</div>
                </div>
            </div>
        </section>

    {/if}
</div>

<style>
    .page { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }

    .page-header {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .page-title    { font-size: 1.5rem; font-weight: 700; margin: 0 0 .25rem; }
    .page-subtitle { font-size: .85rem; color: #64748b; margin: 0; line-height: 1.4; }

    .refresh-btn {
        background: none; border: 1px solid #d1fae5; border-radius: .375rem;
        padding: .375rem .625rem; cursor: pointer; color: #059669; font-size: 1rem;
        flex-shrink: 0;
    }
    .refresh-btn:hover  { background: #d1fae5; }
    .refresh-btn:disabled { opacity: .4; cursor: default; }

    .error-banner {
        background: #fef2f2; border: 1px solid #fecaca; border-radius: .5rem;
        padding: .75rem 1rem; color: #dc2626; font-size: .9rem; margin-bottom: 1rem;
    }
    .loading { color: #64748b; padding: 2rem 0; text-align: center; }

    .section { margin-bottom: 2rem; }
    .section-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: .75rem;
    }
    .section-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
    .count {
        background: #f1f5f9; border-radius: 9999px;
        padding: .1rem .55rem; font-size: .8rem; color: #475569; font-weight: 600;
    }

    .card-list { display: flex; flex-direction: column; gap: .5rem; }
    .card {
        border-radius: .5rem; padding: .75rem 1rem;
        border: 1px solid #e2e8f0; background: #fff;
    }
    .card.exists  { border-left: 3px solid #10b981; }
    .card.pending { border-left: 3px solid #f59e0b; }

    .card-row {
        display: flex; align-items: center; justify-content: space-between; gap: .5rem;
        margin-bottom: .25rem;
    }
    .card-name { font-weight: 600; font-size: .95rem; }

    .status-badge {
        font-size: .72rem; font-weight: 600; padding: .15rem .5rem;
        border-radius: 9999px; white-space: nowrap;
    }
    .badge-ok      { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }

    .card-meta {
        font-size: .8rem; color: #64748b;
        display: flex; align-items: center; gap: .35rem; margin-bottom: .25rem;
        flex-wrap: wrap;
    }
    .id     { font-family: monospace; font-size: .78rem; color: #334155; }
    .sep    { color: #cbd5e1; }
    .source { color: #94a3b8; }

    .mandate {
        font-size: .82rem; color: #475569; font-style: italic;
        border-top: 1px solid #f1f5f9; margin-top: .5rem; padding-top: .5rem;
    }

    .sub-list {
        border-top: 1px solid #f1f5f9; margin-top: .5rem; padding-top: .5rem;
        display: flex; flex-direction: column; gap: .25rem;
    }
    .sub-item  { display: flex; align-items: center; gap: .5rem; font-size: .82rem; }
    .sub-name  { color: #334155; }
    .unit-type { font-family: monospace; font-size: .75rem; color: #64748b; background: #f8fafc; padding: .05rem .3rem; border-radius: .25rem; }

    .governs-list {
        display: flex; align-items: center; flex-wrap: wrap; gap: .4rem;
        border-top: 1px solid #f1f5f9; margin-top: .5rem; padding-top: .5rem;
        font-size: .82rem;
    }
    .governs-label { color: #64748b; font-size: .78rem; }
    .governs-tag {
        background: #eff6ff; color: #1d4ed8;
        border-radius: 9999px; padding: .1rem .5rem; font-size: .75rem;
    }

    .empty { color: #94a3b8; font-size: .88rem; padding: .5rem 0; }

    /* Summary */
    .summary-section { border-top: 1px solid #e2e8f0; padding-top: 1.25rem; }
    .summary-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
    }
    @media (max-width: 500px) {
        .summary-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .summary-cell { text-align: center; }
    .summary-val   { font-size: 1.4rem; font-weight: 700; color: #0f172a; }
    .summary-label { font-size: .75rem; color: #64748b; margin-top: .15rem; }
</style>
