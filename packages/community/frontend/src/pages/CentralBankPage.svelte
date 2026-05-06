<script lang="ts">
    import { getEconomics, getConstitution } from "../lib/api.js";
    import type { EconomicsDto, GoverningDocumentDto } from "../lib/api.js";
    import { currentPage } from "../lib/session.js";

    let econ   = $state<EconomicsDto | null>(null);
    let con    = $state<GoverningDocumentDto | null>(null);
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
</script>

<div class="detail-page">
    <div class="top-bar">
        <button class="back-btn" onclick={() => currentPage.go("governance")}>← Governance</button>
        <button class="refresh-btn" onclick={load} disabled={loading} aria-label="Refresh">↻</button>
    </div>

    <div class="hero cb">
        <div class="hero-icon">⊕</div>
        <div>
            <h2>Central Bank</h2>
            <p>Issues and retires kin — the community's internal currency.</p>
        </div>
    </div>

    {#if loading && !econ}
        <div class="skeleton"></div>
        <div class="skeleton short"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if econ}

        <!-- Primary stat -->
        <section class="stat-card">
            <div class="stat-label">Kin in circulation</div>
            {#if econ.centralBank}
                <div class="stat-value cb-color">{fmt(econ.centralBank.kinInCirculation)}<span class="stat-unit"> kin</span></div>
                <p class="stat-note">
                    Represents the total kin currently held across all member accounts.
                    The supply rises with new issuances (birthdays, joins) and
                    falls when demurrage retires unanchored kin back to the central bank.
                </p>
            {:else}
                <div class="stat-offline">Unavailable — bank offline</div>
            {/if}
        </section>

        <!-- Person years -->
        {#if econ.demographics}
            {@const py  = econ.demographics.totalPersonYears}
            {@const kpy = param("kinPerPersonYear", 1000)}
            {@const theoreticalSupply = py * kpy}
            {@const circ = econ.centralBank?.kinInCirculation ?? 0}
            {@const backingPct = theoreticalSupply > 0 ? circ / theoreticalSupply : null}
            <section class="stat-card py-card">
                <div class="py-row">
                    <div>
                        <div class="stat-label">Total person-years</div>
                        <div class="stat-value">{fmt(py)}<span class="stat-unit"> py</span></div>
                    </div>
                    <div class="py-divider"></div>
                    <div>
                        <div class="stat-label">Theoretical max supply</div>
                        <div class="stat-value">{fmt(theoreticalSupply)}<span class="stat-unit"> kin</span></div>
                    </div>
                    {#if backingPct !== null}
                        <div class="py-divider"></div>
                        <div>
                            <div class="stat-label">Circulation / max</div>
                            <div class="stat-value" class:backed-low={backingPct < 0.5} class:backed-ok={backingPct >= 0.5}>{pct(backingPct)}</div>
                        </div>
                    {/if}
                </div>
                <p class="stat-note">
                    Each person-year earns <strong>{fmt(kpy)} kin</strong> over a lifetime ({fmt(kpy)} kin/year × age).
                    The theoretical maximum is the sum of all members' ages multiplied by that rate —
                    the ceiling the community's currency is anchored to.
                </p>
            </section>
        {/if}

        <!-- Demographics -->
        {#if econ.demographics && econ.demographics.total > 0}
            {@const d = econ.demographics}
            {@const nonWorking = d.children + d.retired + d.disabled}
            {@const ratio = nonWorking === 0 ? null : (d.workingAge / nonWorking).toFixed(1)}
            <section class="stat-card demo-card">
                <div class="demo-header">
                    <div>
                        <div class="stat-label">Working-age population</div>
                        <div class="demo-counts">
                            <span class="demo-big">{d.workingAge}</span>
                            <span class="demo-of">of {d.total}</span>
                            {#if ratio !== null}
                                <span class="demo-ratio">{ratio}:1 ratio to dependants</span>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Stacked bar -->
                <div class="demo-bar-wrap">
                    <div class="demo-bar">
                        {#if d.workingAge > 0}
                            <div class="bar-seg seg-working" style="width:{(d.workingAge/d.total*100).toFixed(1)}%" title="Working age {d.workingAge}"></div>
                        {/if}
                        {#if d.children > 0}
                            <div class="bar-seg seg-children" style="width:{(d.children/d.total*100).toFixed(1)}%" title="Children {d.children}"></div>
                        {/if}
                        {#if d.retired > 0}
                            <div class="bar-seg seg-retired" style="width:{(d.retired/d.total*100).toFixed(1)}%" title="Retired {d.retired}"></div>
                        {/if}
                        {#if d.disabled > 0}
                            <div class="bar-seg seg-disabled" style="width:{(d.disabled/d.total*100).toFixed(1)}%" title="Disabled {d.disabled}"></div>
                        {/if}
                    </div>
                    <div class="demo-legend">
                        <span class="leg-dot dot-working"></span>Working ({d.workingAgeMin}–{d.retirementAge - 1})
                        {#if d.children > 0}<span class="leg-dot dot-children"></span>Under {d.workingAgeMin}{/if}
                        {#if d.retired  > 0}<span class="leg-dot dot-retired"></span>Retired{/if}
                        {#if d.disabled > 0}<span class="leg-dot dot-disabled"></span>Disabled{/if}
                    </div>
                </div>

                <p class="stat-note">
                    Working age: {d.workingAgeMin}–{d.retirementAge - 1}. A healthy ratio keeps the community's
                    payroll commitments manageable. Disabled members are exempt from work expectations
                    and excluded from this ratio.
                </p>
            </section>
        {/if}

        <!-- Policy parameters -->
        {#if con}
            <section class="policy-card">
                <h3 class="section-title">Monetary policy</h3>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Demurrage rate</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{pct(param("bankDemurrageRate", 0.02))} / month</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Demurrage-free floor</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{fmt(param("demurrageFloor", 1000))} kin</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Community dues rate</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{pct(param("communityDuesRate", 0.01))} / month</strong>
                </div>

                <div class="policy-row">
                    <div class="policy-label">
                        <span class="policy-name">Birthday circulation split</span>
                        <span class="policy-auth">referendum</span>
                    </div>
                    <strong class="policy-value">{pct(param("birthdayCirculationFraction", 0.2))} to member</strong>
                </div>
            </section>
        {/if}

        <!-- How it works -->
        <section class="explainer-card">
            <h3 class="section-title">How it works</h3>

            <div class="explainer-block">
                <div class="expl-icon">⊕</div>
                <div>
                    <strong>Kin issuance</strong>
                    <p>
                        Kin enters circulation in two ways: a birthday issuance credited
                        annually to each member (split between the member's account and the
                        social insurance pool), and a join endowment for new members based on
                        their age.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">↻</div>
                <div>
                    <strong>Demurrage</strong>
                    <p>
                        Monthly, the central bank charges a small percentage of every
                        balance above the demurrage floor. The collected kin is retired —
                        removing it from circulation entirely. This keeps the supply from
                        accumulating indefinitely and encourages active participation.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">⊞</div>
                <div>
                    <strong>Community dues</strong>
                    <p>
                        A separate monthly dues collection moves kin from member accounts into the
                        community treasury. Unlike demurrage, collected kin is not retired —
                        it is available for collective spending. This is the community's
                        operating budget.
                    </p>
                </div>
            </div>

            <div class="explainer-block">
                <div class="expl-icon">⊚</div>
                <div>
                    <strong>Governance</strong>
                    <p>
                        The demurrage rate, demurrage floor, and dues rate can all be
                        changed by a community-wide referendum. Changes take effect at
                        the next scheduled monthly processing.
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
    .hero.cb { background: #f0fdf4; border: 1px solid #bbf7d0; }

    .hero-icon {
        font-size: 2rem;
        width: 3.2rem;
        height: 3.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #dcfce7;
        border-radius: 14px;
        flex-shrink: 0;
        color: #15803d;
    }

    .hero h2 { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin: 0 0 0.25rem; }
    .hero p  { font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5; }

    /* Skeleton */
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

    .cb-color   { color: #15803d; }

    /* Person-years card */
    .py-card { padding: 1.1rem 1.25rem; }

    .py-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem 1.5rem;
        align-items: flex-start;
        margin-bottom: 0.75rem;
    }

    .py-divider {
        width: 1px;
        align-self: stretch;
        background: #e2e8f0;
        flex-shrink: 0;
    }

    .backed-low  { color: #b45309; }
    .backed-ok   { color: #15803d; }

    /* Demographics card */
    .demo-card { padding: 1.1rem 1.25rem; }

    .demo-header { margin-bottom: 0.85rem; }

    .demo-counts {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-top: 0.25rem;
    }
    .demo-big   { font-size: 2rem; font-weight: 800; color: #15803d; font-variant-numeric: tabular-nums; line-height: 1; }
    .demo-of    { font-size: 0.9rem; color: #64748b; }
    .demo-ratio { font-size: 0.82rem; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 0.15rem 0.5rem; }

    .demo-bar-wrap { margin-bottom: 0.85rem; }
    .demo-bar {
        height: 10px;
        border-radius: 99px;
        background: #e2e8f0;
        overflow: hidden;
        display: flex;
        margin-bottom: 0.45rem;
    }
    .bar-seg { height: 100%; }
    .seg-working  { background: #34d399; }
    .seg-children { background: #93c5fd; }
    .seg-retired  { background: #c4b5fd; }
    .seg-disabled { background: #fca5a5; }

    .demo-legend {
        font-size: 0.75rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
    }
    .leg-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    .dot-working  { background: #34d399; }
    .dot-children { background: #93c5fd; }
    .dot-retired  { background: #c4b5fd; }
    .dot-disabled { background: #fca5a5; }

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

    .policy-label {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
    }
    .policy-name { font-size: 0.875rem; font-weight: 500; color: #1e293b; }
    .policy-auth {
        font-size: 0.7rem;
        color: #94a3b8;
        text-transform: capitalize;
    }
    .policy-value {
        font-size: 0.9rem;
        font-weight: 700;
        color: #0f172a;
        text-align: right;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }

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
