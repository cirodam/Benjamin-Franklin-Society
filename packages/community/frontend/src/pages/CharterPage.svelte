<script lang="ts">
    import { getCharter } from "../lib/api.js";
    import type { BylawDto, DocumentSection } from "../lib/api.js";
    import { currentPage, selectedSection } from "../lib/session.js";
    import { formatDate } from "../lib/utils.js";

    let charter: BylawDto | null = $state(null);
    let loading = $state(true);
    let error   = $state("");

    $effect(() => {
        getCharter()
            .then(c => { charter = c; })
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load charter"; })
            .finally(() => { loading = false; });
    });

    function openSection(section: DocumentSection) {
        if (!charter) return;
        selectedSection.set({
            docId:     "charter",
            docTitle:  charter.title,
            backPage:  "charter",
            sectionId: section.id,
        });
        currentPage.go("section");
    }
</script>

<div class="charter-page doc-viewer">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("documents")}>‹ Documents</button>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="state-msg error">{error}</div>
    {:else if charter}

        <div class="doc-header">
            <div class="doc-meta-row">
                <span class="doc-meta-label">Adopted {formatDate(charter.adoptedAt)}</span>
            </div>
            <h1 class="doc-title">{charter.title}</h1>
            {#if charter.preamble}
                <p class="doc-preamble">{charter.preamble}</p>
            {/if}
        </div>

        {#each charter.articles as article (article.number)}
            <section class="article">
                <h2 class="article-heading">
                    <span class="article-number">Article {article.number}</span>
                    {article.title}
                </h2>
                {#if article.preamble}
                    <p class="article-preamble">{article.preamble}</p>
                {/if}

                <div class="section-list">
                    {#each article.sections as section (section.id)}
                        <button class="section-btn" onclick={() => openSection(section)}>
                            <div class="section-btn-top">
                                <span class="section-btn-id">§ {section.id}</span>
                                {#if section.title}
                                    <span class="section-btn-title">{section.title}</span>
                                {/if}
                            </div>
                            <p class="section-btn-snippet">{section.body}</p>
                        </button>
                    {/each}
                </div>
            </section>
        {/each}

        <p class="charter-footer">
            This charter defines what the Benjamin Franklin Society is. It is maintained by the
            founding societies and amended by agreement among established societies.
        </p>

    {/if}
</div>

<style>
    .charter-page {
        padding: 1.5rem 1.25rem 6rem;
        max-width: 680px;
        margin: 0 auto;
    }

    .page-header { margin-bottom: 1.5rem; }

    .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #15803d;
        padding: 0;
    }

    .state-msg {
        color: #64748b;
        font-size: 0.9rem;
        margin-top: 2rem;
        text-align: center;
    }
    .state-msg.error { color: #dc2626; }

    /* ── Document header ──────────────────────────────────────────────── */

    .doc-header {
        margin-bottom: 2.5rem;
        border-bottom: 2px solid #15803d;
        padding-bottom: 1.25rem;
    }

    .doc-meta-label {
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .doc-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        margin: 0 0 0.75rem;
    }

    .doc-preamble {
        font-size: 0.875rem;
        color: #475569;
        line-height: 1.65;
        margin: 0.75rem 0 0;
        font-style: italic;
        border-left: 3px solid #bbf7d0;
        padding-left: 0.75rem;
    }

    /* ── Articles ─────────────────────────────────────────────────────── */

    .article {
        margin-bottom: 2.5rem;
    }

    .article-heading {
        font-size: 1rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .article-number {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #15803d;
    }

    .article-preamble {
        font-size: 0.875rem;
        color: #475569;
        line-height: 1.65;
        margin: 0 0 1rem;
        font-style: italic;
        border-left: 3px solid #bbf7d0;
        padding-left: 0.75rem;
    }

    /* ── Section buttons ──────────────────────────────────────────────── */

    .section-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .section-btn {
        display: block;
        width: 100%;
        text-align: left;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: border-color 0.12s, box-shadow 0.12s;
    }
    .section-btn:hover {
        border-color: #86efac;
        box-shadow: 0 1px 4px rgba(21, 128, 61, 0.07);
    }

    .section-btn-top {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.3rem;
    }

    .section-btn-id {
        font-size: 0.7rem;
        font-weight: 700;
        color: #15803d;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
    }

    .section-btn-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #0f172a;
    }

    .section-badge {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        margin-left: auto;
    }
    .badge-expired { background: #fee2e2; color: #b91c1c; }
    .badge-sunset  { background: #fef3c7; color: #b45309; }

    .section-btn-snippet {
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.5;
        margin: 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    /* ── Footer ───────────────────────────────────────────────────────── */

    .charter-footer {
        font-size: 0.82rem;
        color: #a0aec0;
        font-style: italic;
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid #e2e8f0;
    }
</style>
