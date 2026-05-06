<script lang="ts">
    import { getBylaw, addBylawArticle, addBylawSection, listVoteRules, getAuthorities } from "../lib/api.js";
    import type { BylawDto, VoteRule, AuthorityDto } from "../lib/api.js";
    import { currentPage, session, selectedBylawId, selectedSection } from "../lib/session.js";
    import { formatDate } from "../lib/utils.js";
    import VoteRuleDetails from "../components/VoteRuleDetails.svelte";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";

    const bylawId = $derived($selectedBylawId ?? "");
    const isSteward = $derived($session?.isSteward ?? false);

    let doc: BylawDto | null = $state(null);
    let voteRules: VoteRule[]  = $state([]);
    let authorities: AuthorityDto[] = $state([]);
    let loading = $state(true);
    let error   = $state("");

    $effect(() => {
        if (!bylawId) return;
        loading = true; error = "";
        Promise.all([getBylaw(bylawId), listVoteRules(), getAuthorities()])
            .then(([d, r, a]) => { doc = d; voteRules = r; authorities = a; })
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load bylaw"; })
            .finally(() => { loading = false; });
    });

    function openSection(sectionId: string) {
        if (!doc) return;
        selectedSection.set({
            docId:     doc.id,
            docTitle:  doc.title,
            backPage:  "bylaw",
            sectionId,
        });
        currentPage.go("section");
    }

    // ── Add article form ──────────────────────────────────────────────────────
    let showAddArticle   = $state(false);
    let addArticleNum    = $state("");
    let addArticleTitle  = $state("");
    let addArticlePre    = $state("");
    let addingArticle    = $state(false);
    let addArticleError  = $state("");

    async function submitArticle() {
        addArticleError = "";
        if (!addArticleNum.trim() || !addArticleTitle.trim()) { addArticleError = "Number and title are required."; return; }
        addingArticle = true;
        try {
            doc = await addBylawArticle(bylawId, addArticleNum.trim(), addArticleTitle.trim(), addArticlePre.trim() || undefined);
            showAddArticle = false; addArticleNum = ""; addArticleTitle = ""; addArticlePre = "";
        } catch (e) {
            addArticleError = e instanceof Error ? e.message : "Failed to add article";
        } finally {
            addingArticle = false;
        }
    }

    // ── Add section form ──────────────────────────────────────────────────────
    let addingSectionForArticle = $state<string | null>(null);
    let addSectionId    = $state("");
    let addSectionTitle = $state("");
    let addSectionBody  = $state("");
    let addingSection   = $state(false);
    let addSectionError = $state("");

    function startAddSection(articleNumber: string) {
        addingSectionForArticle = articleNumber;
        addSectionId = ""; addSectionTitle = ""; addSectionBody = ""; addSectionError = "";
    }

    async function submitSection() {
        addSectionError = "";
        if (!addSectionId.trim() || !addSectionBody.trim()) { addSectionError = "Section ID and body are required."; return; }
        addingSection = true;
        try {
            doc = await addBylawSection(bylawId, addingSectionForArticle!, addSectionId.trim(), addSectionTitle.trim(), addSectionBody.trim());
            addingSectionForArticle = null;
        } catch (e) {
            addSectionError = e instanceof Error ? e.message : "Failed to add section";
        } finally {
            addingSection = false;
        }
    }

</script>

<div class="bylaw-page doc-viewer">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("documents")}>‹ Documents</button>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="state-msg error">{error}</div>
    {:else if doc}

        <!-- Document header -->
        <div class="doc-header">
            <div class="doc-meta-row">
                <span class="doc-meta-label">Version {doc.version}</span>
                <span class="doc-meta-sep">·</span>
                <span class="doc-meta-label">Adopted {formatDate(doc.adoptedAt)}</span>
                {#if doc.expiresAt}
                    <span class="doc-meta-sep">·</span>
                    <span class="doc-meta-label">Expires {formatDate(doc.expiresAt)}</span>
                {/if}
            </div>
            {#if doc.expiresAt}
                {@const now = Date.now()}
                {@const expiry = new Date(doc.expiresAt).getTime()}
                {#if expiry <= now}
                    <div class="expiry-banner expiry-expired">⚠ This bylaw has expired. The community should re-adopt or repeal it via a motion.</div>
                {:else if expiry - now <= 90 * 24 * 3600 * 1000}
                    <div class="expiry-banner expiry-soon">⏳ This bylaw expires on {formatDate(doc.expiresAt)}. Consider renewing it via an amend-bylaw motion.</div>
                {/if}
            {/if}
            <h1 class="doc-title">{doc.title}</h1>
            {#if doc.preamble}
                <p class="doc-preamble">{doc.preamble}</p>
            {/if}
            <div class="doc-governance">
                <div class="doc-governance-top">
                    <span class="meta-label">Governed &amp; amended by</span>
                    <AuthorityBadge authorityId={doc.authorityId} {authorities} />
                </div>
                <VoteRuleDetails ruleId={doc.voteRuleId} rules={voteRules} />
            </div>
        </div>

        <!-- Articles -->
        {#each (doc.articles ?? []) as article}
            <section class="article">
                <h2 class="article-heading">
                    <span class="article-number">Article {article.number}</span>
                    {article.title}
                </h2>
                {#if article.preamble}
                    <p class="article-preamble">{article.preamble}</p>
                {/if}

                <div class="section-list">
                    {#each article.sections as section}
                        <button class="section-btn" onclick={() => openSection(section.id)}>
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

                <!-- Add section to this article -->
                {#if isSteward}
                    {#if addingSectionForArticle === article.number}
                        <div class="add-form">
                            <div class="add-form-title">Add Section to Article {article.number}</div>
                            <label class="field">
                                <span>Section ID <small>(e.g. {article.number}.1)</small></span>
                                <input type="text" bind:value={addSectionId} placeholder="{article.number}.1" disabled={addingSection} />
                            </label>
                            <label class="field">
                                <span>Title <small>(optional)</small></span>
                                <input type="text" bind:value={addSectionTitle} disabled={addingSection} />
                            </label>
                            <label class="field">
                                <span>Body</span>
                                <textarea rows={4} bind:value={addSectionBody} disabled={addingSection}></textarea>
                            </label>
                            {#if addSectionError}<p class="field-error">{addSectionError}</p>{/if}
                            <div class="edit-actions">
                                <button class="save-btn" onclick={submitSection} disabled={addingSection || !addSectionId.trim() || !addSectionBody.trim()}>
                                    {addingSection ? "Adding…" : "Add Section"}
                                </button>
                                <button class="cancel-btn" onclick={() => addingSectionForArticle = null} disabled={addingSection}>Cancel</button>
                            </div>
                        </div>
                    {:else}
                        <button class="add-link" onclick={() => startAddSection(article.number)}>+ Add Section</button>
                    {/if}
                {/if}
            </section>
        {/each}

        <!-- Add article -->
        {#if isSteward}
            {#if showAddArticle}
                <div class="add-form">
                    <div class="add-form-title">Add Article</div>
                    <label class="field">
                        <span>Article number <small>(e.g. I, II, III)</small></span>
                        <input type="text" bind:value={addArticleNum} placeholder="I" disabled={addingArticle} />
                    </label>
                    <label class="field">
                        <span>Title</span>
                        <input type="text" bind:value={addArticleTitle} disabled={addingArticle} />
                    </label>
                    <label class="field">
                        <span>Preamble <small>(optional)</small></span>
                        <textarea rows={2} bind:value={addArticlePre} disabled={addingArticle}></textarea>
                    </label>
                    {#if addArticleError}<p class="field-error">{addArticleError}</p>{/if}
                    <div class="edit-actions">
                        <button class="save-btn" onclick={submitArticle} disabled={addingArticle || !addArticleNum.trim() || !addArticleTitle.trim()}>
                            {addingArticle ? "Adding…" : "Add Article"}
                        </button>
                        <button class="cancel-btn" onclick={() => showAddArticle = false} disabled={addingArticle}>Cancel</button>
                    </div>
                </div>
            {:else}
                <button class="add-link" onclick={() => showAddArticle = true}>+ Add Article</button>
            {/if}
        {:else if doc.articles.length === 0}
            <p class="empty-state">No articles have been added to this bylaw yet.</p>
        {/if}

    {/if}
</div>

<style>
    .bylaw-page {
        padding: 1rem 1.5rem 6rem;
        max-width: 720px;
        margin: 0 auto;
    }

    @media (min-width: 768px) {
        .bylaw-page { padding-bottom: 2rem; }
    }

    .page-header { margin-bottom: 0.5rem; }

    .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #16a34a;
        padding: 0.25rem 0;
        font-weight: 500;
    }
    .back-btn:hover { text-decoration: underline; }

    .doc-header { margin-bottom: 2rem; }

    .expiry-banner {
        border-radius: 6px;
        padding: 0.6rem 0.9rem;
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0.75rem 0;
    }
    .expiry-banner.expiry-expired {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
    }
    .expiry-banner.expiry-soon {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fcd34d;
    }

    /* .doc-meta-row / .doc-meta-sep — shared in app.css under .doc-viewer */
    .doc-meta-label { font-size: 0.8rem; color: #94a3b8; }

    .doc-title { font-size: 1.6rem; font-weight: 800; color: #0f172a; margin: 0 0 0.75rem; }
    .doc-preamble { font-size: 0.95rem; color: #475569; line-height: 1.7; font-style: italic; margin: 0; }

    .doc-governance {
        margin-top:     0.85rem;
        padding:        0.65rem 0.85rem;
        border-radius:  8px;
        border:         1px solid #e2e8f0;
        background:     #f8fafc;
        display:        flex;
        flex-direction: column;
        gap:            0.45rem;
    }
    .doc-governance-top { display: flex; align-items: center; gap: 0.4rem; }
    .meta-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; }

    /* Articles */
    .article {
        margin-bottom: 2.5rem;
        border-left: 3px solid #dcfce7;
        padding-left: 1.25rem;
    }

    .article-heading {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.5rem;
    }

    .article-number {
        display: block;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #16a34a;
        margin-bottom: 0.15rem;
    }

    .article-preamble { font-size: 0.9rem; color: #64748b; font-style: italic; margin: 0 0 1rem; line-height: 1.6; }

    /* Sections */
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
        color: #16a34a;
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

    .add-link {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.78rem;
        color: #16a34a;
        padding: 0;
        font-weight: 500;
        display: block;
        margin-top: 0.75rem;
    }
    .add-link:hover { text-decoration: underline; }

    /* Edit / add forms */
    .section-edit-area,
    .add-form {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 0.5rem;
    }

    .add-form-title { font-size: 0.85rem; font-weight: 600; color: #374151; }

    .section-textarea {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.9rem;
        padding: 0.65rem 0.85rem;
        resize: vertical;
        font-family: inherit;
        outline: none;
        line-height: 1.6;
        box-sizing: border-box;
    }
    .section-textarea:focus { border-color: #16a34a; }

    .field { display: flex; flex-direction: column; gap: 0.3rem; }
    .field span { font-size: 0.82rem; font-weight: 500; color: #374151; }
    .field small { font-weight: 400; opacity: 0.6; }
    .field input, .field textarea {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.9rem;
        padding: 0.55rem 0.8rem;
        outline: none;
        resize: vertical;
        font-family: inherit;
        transition: border-color 0.15s;
    }
    .field input:focus, .field textarea:focus { border-color: #16a34a; }

    .field-error { font-size: 0.8rem; color: #dc2626; margin: 0; }

    /* .edit-error / .edit-actions / .save-btn / .cancel-btn — shared in app.css under .doc-viewer */

    .state-msg { padding: 3rem 0; text-align: center; color: #94a3b8; }
    .state-msg.error { color: #dc2626; }
    .empty-state { color: #94a3b8; font-size: 0.9rem; padding: 1rem 0; }
</style>
