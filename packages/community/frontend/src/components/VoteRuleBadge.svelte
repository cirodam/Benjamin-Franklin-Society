<script lang="ts">
    import type { VoteRule } from "../lib/api.js";

    interface Props {
        ruleId:    string | null | undefined;
        /** Resolved fallback rule id (from doc level) when ruleId is null */
        fallbackId?: string | null;
        rules:     VoteRule[];
    }

    let { ruleId, fallbackId, rules }: Props = $props();

    const effectiveId = $derived(ruleId ?? fallbackId ?? "");
    const inherits    = $derived(!ruleId && !!fallbackId);

    const rule = $derived(rules.find(r => r.id === effectiveId) ?? null);

    function pctLabel(f: number | undefined): string {
        if (f === undefined) return "";
        const pct = Math.round(f * 100);
        return ` · ${pct}%`;
    }

    const label = $derived(() => {
        if (!rule) return effectiveId || "?";
        return rule.label;
    });

    const detail = $derived(() => {
        if (!rule) return "";
        if (rule.legitimacy === "petition") return " (petition)";
        return pctLabel(rule.thresholdFraction);
    });
</script>

<span class="vrule-badge" class:inherited={inherits} title={inherits ? `Inherits: ${label()}` : label()}>
    {label()}{detail()}{#if inherits}<span class="inherit-dot">↑</span>{/if}
</span>

<style>
    .vrule-badge {
        display:       inline-flex;
        align-items:   center;
        gap:           0.2em;
        padding:       0.15em 0.55em;
        border-radius: 999px;
        font-size:     0.72rem;
        font-weight:   600;
        letter-spacing: 0.02em;
        background:    #eff6ff;
        color:         #1d4ed8;
        white-space:   nowrap;
    }

    .vrule-badge.inherited {
        background: #f8fafc;
        color:      #64748b;
        border:     1px solid #e2e8f0;
    }

    .inherit-dot {
        font-size: 0.65em;
        opacity:   0.7;
    }
</style>
