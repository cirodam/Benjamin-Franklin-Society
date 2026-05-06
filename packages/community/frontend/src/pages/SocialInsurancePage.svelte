<script lang="ts">
    import { getEconomics, getConstitution } from "../lib/api.js";
    import type { EconomicsDto, GoverningDocumentDto } from "../lib/api.js";
    import { currentPage } from "../lib/session.js";

    let econ    = $state<EconomicsDto | null>(null);
    let con     = $state<GoverningDocumentDto | null>(null);
    let loading = $state(true);
    let error   = $state("");

    async function load() {
        loading = true;
        error   = "";
        try {
            [econ, con] = await Promise.all([getEconomics(), getConstitution()]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    function fmt(n: number): string {
        return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function pct(n: number): string {
        return (n * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
    }

    function param(key: string, fallback: number): number {
        const p = con?.parameters?.[key];
        return (p && typeof p.value === "number") ? p.value : fallback;
    }

    const si = $derived(econ?.socialInsurance ?? null);
    const netRetained = $derived(si ? si.totalContributed - si.totalPaidOut : 0);
</script>

<div class="detail-page">
    <div class="top-bar">
        <button class="back-btn" onclick={() => currentPage.go("governance")}>← Governance</button>
        <button class="refresh-btn" onclick={load} disabled={loading} aria-label="Refresh">↻</button>
    </div>

    <div class="hero si">
        <div class="hero-icon">⊞</div>
        <div>
            <h2>Social Insurance</h2>
            <p>Community retirement pool — funded by member contributions, paid out monthly to retirees.</p>
        </div>
    </div>

    {#if loading && !econ}
        <div class="skeleton"></div>
        <div class="skeleton short"></div>
        <div class="skeleton short"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if econ}

        {#if !econ.ready}
            <div class="degraded-banner">
                <span>⚠</span>
                <div>
                    <strong>Bank offline</strong>
                    <p>Live pool data unavailable. The bank node is not reachable.</p>
                </div>
            </div>
        {/if}

        <!-- Pool balance hero stat -->
        <section class="stat-card">
            <div class="stat-label">Pool balance</div>
            {#if si}
                <div class="stat-value si-color">{fmt(si.poolBalance)}<span class="stat-unit"> kin</span></div>
                <p class="stat-note">
                    The total kin currently held in the social insurance pool.
                    This balance is excluded from demurrage — it accumulates
                    at full face value until distributed to retirees.
                </p>
            {:else if econ.ready}
                <div class="stat-offline">Social Insurance not yet initialised</div>
            {:else}
                <div class="stat-offline">Unavailable — bank offline</div>
            {/if}
        </section>

        <!-- 2×2 metrics grid -->
        {#if si}
            <section class="metrics-card">
                <div class="metrics-grid">
                    <div class="mini-stat">
                        <span class="mini-label">Total contributed</span>
                        <strong class="mini-value">{fmt(si.totalContributed)}</strong>
                        <span class="mini-unit">kin</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-label">Total paid out</span>
                        <strong class="mini-value">{fmt(si.totalPaidOut)}</strong>
                        <span class="mini-unit">kin</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-label">Members in pool</span>
                        <strong class="mini-value">{si.memberCount}</strong>
                        <span class="mini-unit">members</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-label">Net retained</span>
                        <strong class="mini-value {netRetained >= 0 ? 'positive' : 'negative'}">{fmt(netRetained)}</strong>
                        <span class="mini-unit">kin</span>
                    </div>
                </div>
            </section>
        {/if}

        <!-- Policy parameters -->
        {#if con}
            <section class="policy-card">
                <h3 class="section-title">Policy parameters</h3>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Retirement age</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{param("retirementAge", 65)} years</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Monthly payout (per retiree)</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{fmt(param("retirementPayoutRate", 500))} kin/month</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Birthday SI contribution</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{pct(1 - param("birthdayCirculationFraction", 0.2))} of annual issuance</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Join endowment pool fraction</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{pct(param("endowmentPoolFraction", 0.8))} of endowment</strong>
                </div>
            </section>
        {/if}

        <!-- How it works -->
        <section class="explainer-card">
            <h3 class="section-title">How it works</h3>

            <div class="explainer-block">
                <div class="expl-icon">⊕</div>
                <div>
                    <strong>Contributions</strong>
                    <p>
                        Kin flows into the pool automatically from two sources: a share
                        of every member's annual birthday issuance, and a portion of
                        the join endowment credited when a new member joins. Neither
                        requires action from the member — both are governed by constitution
                        parameters.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">⊞</div>
                <div>
                    <strong>Retirement payouts</strong>
                    <p>
                        Once a member reaches the constitutional retirement age, they
                        become eligible for monthly distributions. Each month a flat
                        kin amount is paid to each retiree from the pool. If the pool
                        balance is insufficient, the per-person amount is reduced
                        proportionally so the pool is never overdrawn.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">↻</div>
                <div>
                    <strong>Demurrage exemption</strong>
                    <p>
                        The pool account is excluded from the central bank's monthly
                        demurrage. This ensures that deferred liabilities are not
                        quietly eroded over time and that members can plan around
                        expected retirement balances.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">⊚</div>
                <div>
                    <strong>Member departure</strong>
                    <p>
                        When a member leaves the community, their unclaimed entitlement
                        is burned rather than transferred. This keeps the kin supply
                        honest — no kin escapes the community economy on departure.
                    </p>
                </div>
            </div>
        </section>

    {/if}
</div>

<style>
    .detail-page {
        padding: 1.25rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
    }

    .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .back-btn {
        background: none;
        border: none;
        font-size: 0.9rem;
        font-weight: 600;
        color: #15803d;
        cursor: pointer;
        padding: 0.25rem 0;
    }
    .back-btn:hover { text-decoration: underline; }

    .refresh-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #64748b;
        cursor: pointer;
        padding: 0.25rem;
        transition: transform 0.3s;
    }
    .refresh-btn:disabled { opacity: 0.4; }

    /* Hero */
    .hero {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 18px;
        margin-bottom: 1.25rem;
    }
    .hero.si { background: #faf5ff; border: 1px solid #e9d5ff; }

    .hero-icon {
        font-size: 2rem;
        width: 3.2rem;
        height: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ede9fe;
        border-radius: 14px;
        flex-shrink: 0;
        color: #7c3aed;
    }

    .hero h2 { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin: 0 0 0.25rem; }
    .hero p  { font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5; }

    .skeleton {
        background: #e2e8f0;
        border-radius: 16px;
        height: 9rem;
        margin-bottom: 1rem;
        animation: pulse 1.4s ease-in-out infinite;
    }
    .skeleton.short { height: 5rem; }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.5; }
    }

    .error-msg { text-align: center; color: #94a3b8; padding: 3rem 0; font-size: 0.95rem; }

    .degraded-banner {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        background: #fef3c7;
        border: 1px solid #fde68a;
        border-radius: 12px;
        padding: 1rem 1.25rem;
        margin-bottom: 1rem;
        font-size: 0.85rem;
        color: #92400e;
    }
    .degraded-banner strong { display: block; font-size: 0.95rem; }
    .si-color     { color: #7c3aed; }

    /* 2×2 mini-metrics */
    .metrics-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        overflow: hidden;
        margin-bottom: 1rem;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .mini-stat {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 1rem 1.25rem;
        border-right: 1px solid #f1f5f9;
        border-bottom: 1px solid #f1f5f9;
    }
    .mini-stat:nth-child(2n)      { border-right: none; }
    .mini-stat:nth-last-child(-n+2) { border-bottom: none; }

    .mini-label { font-size: 0.75rem; color: #64748b; }
    .mini-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
    }
    .mini-value.positive { color: #15803d; }
    .mini-value.negative { color: #dc2626; }
    .mini-unit { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Policy card */
    .policy-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        overflow: hidden;
        margin-bottom: 1rem;
    }

    .section-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #94a3b8;
        margin: 0;
        padding: 1rem 1.25rem 0.6rem;
        border-bottom: 1px solid #f1f5f9;
    }

    .policy-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.7rem 1.25rem;
        border-bottom: 1px solid #f1f5f9;
        gap: 1rem;
    }
    .policy-row:last-child { border-bottom: none; }

    .policy-label { display: flex; flex-direction: column; gap: 0.1rem; }
    .policy-name  { font-size: 0.875rem; font-weight: 500; color: #1e293b; }
    .policy-auth  { font-size: 0.7rem; color: #94a3b8; }
    .policy-value { font-size: 0.9rem; font-weight: 700; color: #0f172a; flex-shrink: 0; font-variant-numeric: tabular-nums; }

    /* Explainer card */
    .explainer-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        overflow: hidden;
        margin-bottom: 1rem;
    }

    .explainer-block {
        display: flex;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #f1f5f9;
    }
    .explainer-block:last-child { border-bottom: none; }

    .expl-icon {
        font-size: 1.1rem;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        border-radius: 8px;
        flex-shrink: 0;
        color: #475569;
    }

    .explainer-block strong { font-size: 0.875rem; font-weight: 700; color: #0f172a; display: block; margin-bottom: 0.3rem; }
    .explainer-block p { font-size: 0.82rem; color: #64748b; margin: 0; line-height: 1.6; }

    @media (min-width: 768px) {
        .detail-page { padding-bottom: 2rem; }
    }
</style>
