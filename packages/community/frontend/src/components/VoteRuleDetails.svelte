<script lang="ts">
    import type { VoteRule } from "../lib/api.js";

    interface Props {
        ruleId:     string | null | undefined;
        /** Doc-level fallback when section has no own rule */
        fallbackId?: string | null;
        rules:      VoteRule[];
    }

    let { ruleId, fallbackId, rules }: Props = $props();

    const effectiveId = $derived(ruleId ?? fallbackId ?? "");
    const inherited   = $derived(!ruleId && !!fallbackId);
    const rule        = $derived(rules.find(r => r.id === effectiveId) ?? null);

    function legitimacyDetail(r: VoteRule): string {
        if (r.legitimacy === "petition") return "requires signatures, no vote";
        const pct = r.thresholdFraction !== undefined
            ? Math.round(r.thresholdFraction * 100) + "%"
            : "50%+";
        if (r.legitimacy === "absolute-majority") return `${pct} of all eligible voters`;
        return `${pct} of votes cast`;
    }
</script>

{#if rule}
    <div class="vrd" class:inherited>
        <div class="vrd-top">
            <span class="vrd-label">{rule.label}</span>
            <span class="vrd-sep">·</span>
            <span class="vrd-detail">{legitimacyDetail(rule)}</span>
            {#if inherited}
                <span class="vrd-inherited-note">inherited</span>
            {/if}
        </div>
        <div class="vrd-meta">
            {#if rule.deliberationDays > 0}
                <span class="vrd-item">{rule.deliberationDays}d deliberation</span>
                <span class="vrd-sep">·</span>
            {/if}
            {#if rule.votingWindowDays > 0}
                <span class="vrd-item">{rule.votingWindowDays}d voting window</span>
            {:else}
                <span class="vrd-item">closes when threshold met</span>
            {/if}
        </div>
    </div>
{:else if effectiveId}
    <div class="vrd vrd-unknown">
        <span class="vrd-label">{effectiveId}</span>
    </div>
{/if}

<style>
    .vrd {
        display:        flex;
        flex-direction: column;
        gap:            0.2rem;
        padding:        0.45rem 0.75rem;
        border-radius:  8px;
        background:     #eff6ff;
        border-left:    3px solid #3b82f6;
    }

    .vrd.inherited {
        background:  #f8fafc;
        border-left: 3px solid #cbd5e1;
    }

    .vrd-unknown {
        background:  #f8fafc;
        border-left: 3px solid #e2e8f0;
    }

    .vrd-top {
        display:     flex;
        align-items: center;
        gap:         0.35rem;
        flex-wrap:   wrap;
    }

    .vrd-label {
        font-size:   0.8rem;
        font-weight: 700;
        color:       #1d4ed8;
    }

    .vrd.inherited .vrd-label {
        color: #64748b;
    }

    .vrd-detail {
        font-size: 0.78rem;
        color:     #334155;
    }

    .vrd.inherited .vrd-detail {
        color: #94a3b8;
    }

    .vrd-inherited-note {
        font-size:   0.68rem;
        font-weight: 600;
        color:       #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-left: 0.15rem;
    }

    .vrd-meta {
        display:     flex;
        align-items: center;
        gap:         0.3rem;
        flex-wrap:   wrap;
    }

    .vrd-item {
        font-size: 0.72rem;
        color:     #64748b;
    }

    .vrd.inherited .vrd-item {
        color: #94a3b8;
    }

    .vrd-sep {
        font-size: 0.7rem;
        color:     #cbd5e1;
    }
</style>
