<script lang="ts">
    import { getAuthorities } from "../lib/api.js";
    import type { AuthorityDto, AuthorityPower } from "../lib/api.js";
    import { currentPage, selectedAuthorityId, selectedSection } from "../lib/session.js";
    import type { Page } from "../lib/session.js";

    let authority = $state<AuthorityDto | null>(null);
    let loading   = $state(true);
    let error     = $state("");

    $effect(() => {
        const id = $selectedAuthorityId;
        if (!id) return;
        loading = true; error = ""; authority = null;
        getAuthorities()
            .then(all => {
                authority = all.find(a => a.id === id) ?? null;
                if (!authority) error = `Authority "${id}" not found.`;
            })
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load"; })
            .finally(() => { loading = false; });
    });

    // Group powers by docId so sections from the same document are together
    const powersByDoc = $derived.by(() => {
        if (!authority) return [] as { docId: string; powers: AuthorityPower[] }[];
        const map = new Map<string, AuthorityPower[]>();
        for (const p of authority.powers) {
            if (!map.has(p.docId)) map.set(p.docId, []);
            map.get(p.docId)!.push(p);
        }
        return [...map.entries()].map(([docId, powers]) => ({ docId, powers }));
    });

    function goToSection(docId: string, sectionId: string, docTitle: string) {
        const backPage: Page = "authority";
        selectedSection.set({ docId, sectionId, docTitle, backPage });
        currentPage.go("section");
    }

    function kindLabel(kind: string): string {
        const labels: Record<string, string> = {
            assembly:     "Sortition Assembly",
            committee:    "Committee",
            referendum:   "Full-Membership Referendum",
            membership:   "Full Membership",
            "leader-pool": "Leader Pool",
        };
        return labels[kind] ?? kind;
    }

    function docTitle(docId: string): string {
        if (docId === "constitution") return "Constitution";
        if (docId === "charter")      return "Charter";
        return docId;
    }

    // Human-readable action labels derived from the same table used in ProposePage
    const ACTION_LABEL: Record<string, string> = {
        "admit-member":             "Admit a member",
        "suspend-member":           "Suspend a member",
        "reinstate-member":         "Reinstate a member",
        "exclude-member":           "Permanently exclude a member",
        "change-dues-rate":         "Change community dues rate",
        "change-demurrage-rate":    "Change demurrage rate",
        "change-demurrage-floor":   "Change demurrage floor",
        "amend-document-parameter": "Amend a constitutional parameter",
        "join-federation":          "Join a federation",
        "leave-federation":         "Leave a federation",
        "split-council":            "Split a domain council",
        "allocate-domain-budget":   "Set domain budget",
        "declare-domain-emergency": "Declare domain emergency",
        "change-market-schedule":   "Change market schedule",
        "enact-domain-statute":     "Enact a domain statute",
    };

    function actionLabel(action: string): string {
        return ACTION_LABEL[action] ?? action.replace(/-/g, " ");
    }
</script>

<div class="page">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("leadership")}>‹ Back</button>
        <h2 class="page-title">
            {#if authority}
                {authority.name}
            {:else}
                Authority
            {/if}
        </h2>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if authority}

        <div class="authority-card">
            <div class="authority-meta">
                <span class="kind-badge">{kindLabel(authority.kind)}</span>
                <span class="vote-rule">Default rule: {authority.defaultVoteRuleId}</span>
            </div>
            {#if authority.description}
                <p class="authority-desc">{authority.description}</p>
            {/if}
        </div>

        <section class="powers-section">
            <h3 class="section-heading">Granted Powers</h3>

            {#if authority.powers.length === 0}
                <p class="empty-note">
                    No powers have been declared for this authority in any active governing document.
                </p>
            {:else}
                {#each powersByDoc as group (group.docId)}
                    <div class="doc-group">
                        <h4 class="doc-group-heading">{docTitle(group.docId)}</h4>
                        <ul class="power-list">
                            {#each group.powers as p (p.action)}
                                <li class="power-item">
                                    <div class="power-main">
                                        <span class="power-action">{actionLabel(p.action)}</span>
                                        <span class="power-rule">{p.voteRuleId}</span>
                                    </div>
                                    <button
                                        class="section-link"
                                        onclick={() => goToSection(p.docId, p.sectionId, docTitle(p.docId))}
                                    >
                                        §{p.sectionId}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            {/if}
        </section>

    {/if}
</div>

<style>
    .page { padding: 1rem; max-width: 640px; margin: 0 auto; }

    .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .back-btn {
        background: none;
        border: none;
        font-size: 1.1rem;
        cursor: pointer;
        color: #16a34a;
        padding: 0.25rem 0.5rem;
    }
    .page-title { margin: 0; font-size: 1.3rem; }

    .authority-card {
        background: #fff;
        border: 1px solid #d1fae5;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1.25rem;
    }
    .authority-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }
    .kind-badge {
        background: #dcfce7;
        color: #15803d;
        border-radius: 999px;
        padding: 0.2rem 0.7rem;
        font-size: 0.78rem;
        font-weight: 600;
    }
    .vote-rule { font-size: 0.85rem; color: #64748b; }
    .authority-desc { margin: 0; font-size: 0.92rem; color: #334155; line-height: 1.5; }

    .powers-section { }
    .section-heading { font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem; color: #0f172a; }

    .empty-note { font-size: 0.9rem; color: #64748b; font-style: italic; }

    .doc-group { margin-bottom: 1.25rem; }
    .doc-group-heading {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #94a3b8;
        margin: 0 0 0.5rem;
    }

    .power-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .power-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.6rem 0.75rem;
    }
    .power-main { display: flex; flex-direction: column; gap: 0.15rem; }
    .power-action { font-size: 0.92rem; font-weight: 500; color: #0f172a; }
    .power-rule {
        font-size: 0.76rem;
        color: #64748b;
        font-family: monospace;
    }
    .section-link {
        background: none;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        color: #16a34a;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .section-link:hover { background: #f0fdf4; }

    .state-msg { color: #64748b; text-align: center; padding: 2rem; }
    .error-msg { color: #dc2626; padding: 1rem; background: #fef2f2; border-radius: 8px; }
</style>
