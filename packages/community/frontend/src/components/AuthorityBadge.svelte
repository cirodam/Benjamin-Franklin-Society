<script lang="ts">
    import type { AuthorityDto } from "../lib/api.js";

    interface Props {
        authorityId:  string;
        authorities?: AuthorityDto[];
    }

    let { authorityId, authorities = [] }: Props = $props();

    const label = $derived(() => {
        const found = authorities.find(a => a.id === authorityId);
        if (found) return found.name;
        // Fallback: humanise built-in ids and pool:<uuid>
        if (authorityId === "assembly")   return "Assembly";
        if (authorityId === "community")  return "The Community";
        if (authorityId.startsWith("pool:")) return "Leader Pool";
        return authorityId;
    });
</script>

<span class="authority-badge">{label()}</span>

<style>
    .authority-badge {
        display:          inline-block;
        padding:          0.15em 0.55em;
        border-radius:    999px;
        font-size:        0.75rem;
        font-weight:      600;
        letter-spacing:   0.02em;
        background:       var(--color-surface-2, #e8e8e8);
        color:            var(--color-text-muted, #555);
        white-space:      nowrap;
    }
</style>
