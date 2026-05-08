<script lang="ts">
    import {
        getMotion, castMotionVote, addMotionComment, recordMotionDissent,
        submitMotionForDeliberation, openMotionVoting,
        markMotionDiscussed, recordMotionOutcome, withdrawMotion,
        listVoteRules,
    } from "../lib/api.js";
    import type { MotionDto, MotionOutcome, CommentKind, VoteRule } from "../lib/api.js";
    import { session, currentPage, selectedMotionId } from "../lib/session.js";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";
    import VoteRuleDetails from "../components/VoteRuleDetails.svelte";

    let motion:  MotionDto | null = $state(null);
    let voteRules: VoteRule[]     = $state([]);
    let loading  = $state(true);
    let error    = $state("");
    let actionError = $state("");

    // comment form
    let commentText = $state("");
    let commentKind = $state<CommentKind>("general");
    let commenting  = $state(false);

    // dissent form
    let dissentText        = $state("");
    let showDissentForm    = $state(false);
    let submittingDissent  = $state(false);

    // comment pagination
    const COMMENT_PAGE_SIZE = 10;
    let commentPage = $state(1);
    const totalCommentPages = $derived(
        motion ? Math.max(1, Math.ceil(motion.comments.length / COMMENT_PAGE_SIZE)) : 1
    );
    const paginatedComments = $derived(
        motion
            ? motion.comments.slice((commentPage - 1) * COMMENT_PAGE_SIZE, commentPage * COMMENT_PAGE_SIZE)
            : []
    );

    // outcome form (admin)
    let showOutcomeForm = $state(false);
    let outcomeChoice   = $state<MotionOutcome>("passed");
    let outcomeNote     = $state("");
    let submittingOutcome = $state(false);

    const me = $derived($session?.handle ?? null);
    const isAdmin = $derived(($session as any)?.isAdmin ?? false);
    const isMembership = $derived(motion?.authorityId === "community");

    const myVote = $derived(
        motion ? motion.votes.find(v => v.handle === me) ?? null : null
    );

    async function load() {
        const id = $selectedMotionId;
        if (!id) return;
        loading = true; error = "";
        try {
            [motion, voteRules] = await Promise.all([getMotion(id), listVoteRules()]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load motion";
        } finally { loading = false; }
    }

    $effect(() => { load(); });

    function back() {
        if (motion?.authorityId === "assembly") currentPage.go("assembly");
        else if (motion?.authorityId?.startsWith("pool:")) currentPage.go("pool");
        else currentPage.go("proposals");
    }

    async function doVote(vote: "approve" | "reject" | "abstain") {
        if (!motion) return;
        actionError = "";
        try { motion = await castMotionVote(motion.id, vote); }
        catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
    }

    async function doComment() {
        if (!motion || !commentText.trim()) return;
        commenting = true; actionError = "";
        try {
            motion = await addMotionComment(motion.id, commentText.trim(), commentKind);
            commentText = ""; commentKind = "general";
            // jump to last page so the new comment is visible
            commentPage = Math.max(1, Math.ceil(motion.comments.length / COMMENT_PAGE_SIZE));
        } catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
        finally { commenting = false; }
    }

    async function doDissent() {
        if (!motion || !dissentText.trim()) return;
        submittingDissent = true; actionError = "";
        try {
            motion = await recordMotionDissent(motion.id, dissentText.trim());
            dissentText = ""; showDissentForm = false;
        } catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
        finally { submittingDissent = false; }
    }

    async function doOpenVoting() {
        if (!motion) return; actionError = "";
        try { motion = await openMotionVoting(motion.id); }
        catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
    }

    async function doMarkDiscussed() {
        if (!motion) return; actionError = "";
        try { motion = await markMotionDiscussed(motion.id); }
        catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
    }

    async function doRecordOutcome() {
        if (!motion) return;
        submittingOutcome = true; actionError = "";
        try {
            motion = await recordMotionOutcome(motion.id, outcomeChoice, outcomeNote);
            showOutcomeForm = false;
        } catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
        finally { submittingOutcome = false; }
    }

    async function doWithdraw() {
        if (!motion) return; actionError = "";
        try { motion = await withdrawMotion(motion.id); }
        catch (e) { actionError = e instanceof Error ? e.message : "Failed"; }
    }

    function formatDate(iso: string | null): string {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function stageBadge(m: MotionDto) {
        if (m.stage === "deliberating") return { label: "Deliberating", cls: "badge-deliberating" };
        if (m.stage === "voting")       return { label: "Voting open",  cls: "badge-voting" };
        if (m.stage === "draft")        return { label: "Draft",        cls: "badge-default" };
        if (m.stage === "resolved") {
            if (m.outcome === "passed")    return { label: "Passed",    cls: "badge-passed" };
            if (m.outcome === "failed")    return { label: "Failed",    cls: "badge-failed" };
            if (m.outcome === "withdrawn") return { label: "Withdrawn", cls: "badge-resolved" };
            if (m.outcome === "referred")  return { label: "Referred",  cls: "badge-resolved" };
        }
        return { label: m.stage, cls: "badge-default" };
    }
</script>

<div class="page">
    <!-- Back -->
    <button class="back-btn" onclick={back}>← Back</button>

    {#if loading}
        <div class="skeleton tall"></div>
    {:else if error}
        <p class="error-msg">{error}</p>
    {:else if motion}
        {@const badge = stageBadge(motion)}

        <!-- Header -->
        <div class="header-row">
            <h1 class="title">{motion.title}</h1>
            <span class="badge {badge.cls}">{badge.label}</span>
        </div>

        <!-- Meta row -->
        <div class="meta-row">
            <span>Proposed by <strong>{motion.proposerHandle}</strong></span>
            <AuthorityBadge authorityId={motion.authorityId} />
            <span>{formatDate(motion.createdAt)}</span>
        </div>

        {#if motion.voteRuleId === "petition" && motion.minApprovals}
            <p class="threshold-note">Petition — needs <strong>{motion.minApprovals}</strong> approval{motion.minApprovals !== 1 ? "s" : ""} to pass</p>
        {:else if motion.voteRuleId}
            <VoteRuleDetails ruleId={motion.voteRuleId} rules={voteRules} />
        {/if}

        <!-- Description -->
        <div class="description">{motion.description}</div>

        <!-- Structured reasoning -->
        {#if motion.premises || motion.expectedOutcome}
            <div class="reasoning-block">
                {#if motion.premises}
                    <div class="reasoning-item">
                        <span class="reasoning-label">Premises</span>
                        <p class="reasoning-body">{motion.premises}</p>
                    </div>
                {/if}
                {#if motion.expectedOutcome}
                    <div class="reasoning-item">
                        <span class="reasoning-label">Expected outcome</span>
                        <p class="reasoning-body">{motion.expectedOutcome}</p>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Outcome banner -->
        {#if motion.stage === "resolved"}
            <div class="outcome-banner" class:outcome-pass={motion.outcome === "passed"} class:outcome-fail={motion.outcome === "failed"}>
                <span class="outcome-label">{motion.outcome?.toUpperCase()}</span>
                {#if motion.outcomeNote}<p class="outcome-note">{motion.outcomeNote}</p>{/if}
                <p class="outcome-date">Resolved {formatDate(motion.resolvedAt)}</p>
            </div>
        {/if}

        <!-- Vote summary -->
        {#if (motion.stage === "voting" || motion.stage === "resolved")}
            <div class="vote-summary">
                {#if motion.voteRuleId === "petition" && motion.minApprovals}
                    {@const pct = Math.min(100, Math.round(motion.approvalCount / motion.minApprovals * 100))}
                    <div class="vote-bar-wrap">
                        <div class="vote-bar">
                            <div class="bar-approve" style="width: {pct}%"></div>
                        </div>
                    </div>
                    <div class="vote-counts">
                        <span class="vc-approve">{motion.approvalCount} / {motion.minApprovals} approvals</span>
                        <span class="vc-total">{motion.votes.length} voted</span>
                    </div>
                {:else}
                    <div class="vote-bar-wrap">
                        <div class="vote-bar">
                            <div class="bar-approve" style="width: {motion.votes.length ? Math.round(motion.approvalCount / motion.votes.length * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="vote-counts">
                        <span class="vc-approve">{motion.approvalCount} approve</span>
                        <span class="vc-reject">{motion.rejectionCount} reject</span>
                        <span class="vc-total">{motion.votes.length} total</span>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Voting actions -->
        {#if motion.stage === "voting" && me && !myVote}
            <div class="vote-actions">
                <button class="btn-approve" onclick={() => doVote("approve")}>Approve</button>
                <button class="btn-reject"  onclick={() => doVote("reject")}>Reject</button>
                <button class="btn-abstain" onclick={() => doVote("abstain")}>Abstain</button>
            </div>
        {:else if myVote}
            <p class="my-vote">You voted: <strong>{myVote.vote}</strong></p>
        {/if}

        <!-- Admin action: open voting -->
        {#if motion.stage === "deliberating" && isAdmin}
            <button class="btn-action" onclick={doOpenVoting}>Open voting now</button>
        {/if}

        <!-- Admin override actions -->
        {#if !isMembership && isAdmin && motion.stage !== "resolved"}
            <div class="clerk-actions">
                {#if !showOutcomeForm}
                    <button class="btn-action" onclick={() => showOutcomeForm = true}>Record outcome</button>
                {:else}
                    <div class="outcome-form">
                        <select class="input select" bind:value={outcomeChoice}>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                            <option value="withdrawn">Withdrawn</option>
                            <option value="referred">Referred</option>
                        </select>
                        <input class="input" type="text" placeholder="Notes (optional)" bind:value={outcomeNote} />
                        <div class="outcome-form-btns">
                            <button class="btn-primary" onclick={doRecordOutcome} disabled={submittingOutcome}>
                                {submittingOutcome ? "Saving…" : "Save outcome"}
                            </button>
                            <button class="btn-ghost" onclick={() => showOutcomeForm = false}>Cancel</button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Withdraw (proposer, not resolved) -->
        {#if me === motion.proposerHandle && motion.stage !== "resolved"}
            <button class="btn-withdraw" onclick={doWithdraw}>Withdraw motion</button>
        {/if}

        {#if actionError}
            <p class="error-msg">{actionError}</p>
        {/if}

        <!-- Comments (all motions) -->
        <hr class="divider" />
        <h2 class="section-heading">Discussion</h2>

        {#if motion.comments.length === 0}
            <p class="empty-msg">No comments yet. Start the discussion.</p>
        {:else}
            {#if totalCommentPages > 1}
                <div class="comment-pagination">
                    <button class="page-btn" onclick={() => commentPage--} disabled={commentPage <= 1}>← Prev</button>
                    <span class="page-info">Page {commentPage} of {totalCommentPages}</span>
                    <button class="page-btn" onclick={() => commentPage++} disabled={commentPage >= totalCommentPages}>Next →</button>
                </div>
            {/if}
            {#each paginatedComments as c (c.id)}
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-author">{c.authorHandle}</span>
                        {#if c.kind && c.kind !== "general"}
                            <span class="comment-kind comment-kind-{c.kind}">{c.kind === "evidence" ? "Evidence" : "Challenge"}</span>
                        {/if}
                        <span class="comment-date">{formatDate(c.createdAt)}</span>
                    </div>
                    <p class="comment-body">{c.body}</p>
                </div>
            {/each}
            {#if totalCommentPages > 1}
                <div class="comment-pagination">
                    <button class="page-btn" onclick={() => commentPage--} disabled={commentPage <= 1}>← Prev</button>
                    <span class="page-info">{(commentPage - 1) * COMMENT_PAGE_SIZE + 1}–{Math.min(commentPage * COMMENT_PAGE_SIZE, motion.comments.length)} of {motion.comments.length}</span>
                    <button class="page-btn" onclick={() => commentPage++} disabled={commentPage >= totalCommentPages}>Next →</button>
                </div>
            {/if}
        {/if}

        {#if me && motion.stage !== "resolved" && motion.stage !== "draft"}
            <div class="comment-form">
                {#if motion.stage === "deliberating"}
                    <div class="comment-kind-row">
                        <span class="comment-kind-label">Type</span>
                        <div class="comment-kind-btns">
                            <button type="button" class="kind-btn" class:kind-active={commentKind === "general"} onclick={() => commentKind = "general"}>Comment</button>
                            <button type="button" class="kind-btn" class:kind-active={commentKind === "evidence"} onclick={() => commentKind = "evidence"}>Evidence</button>
                            <button type="button" class="kind-btn" class:kind-active={commentKind === "challenge"} onclick={() => commentKind = "challenge"}>Challenge premises</button>
                        </div>
                    </div>
                {/if}
                <textarea class="input textarea" placeholder="Add a comment…" bind:value={commentText} rows="3"></textarea>
                <button class="btn-primary" onclick={doComment} disabled={commenting || !commentText.trim()}>
                    {commenting ? "Posting…" : "Post"}
                </button>
            </div>
        {/if}

        <!-- Vote list (collapsed / expandable could be added; showing flat for now) -->
        {#if motion.votes.length > 0}
            <details class="votes-detail">
                <summary>Votes ({motion.votes.length})</summary>
                {#each motion.votes as v (v.handle)}
                    <div class="vote-row">
                        <span class="vote-handle">{v.handle}</span>
                        <span class="vote-val vote-{v.vote}">{v.vote}</span>
                    </div>
                {/each}
            </details>
        {/if}

        <!-- Dissents -->
        {#if motion.dissents && motion.dissents.length > 0}
            <hr class="divider" />
            <h2 class="section-heading">Minority Statements</h2>
            {#each motion.dissents as d}
                <div class="dissent">
                    <div class="dissent-header">
                        <span class="dissent-author">{d.authorHandle}</span>
                        <span class="dissent-date">{formatDate(d.recordedAt)}</span>
                    </div>
                    <p class="dissent-body">{d.body}</p>
                </div>
            {/each}
        {/if}

        <!-- Record dissent (any member, resolved + passed only) -->
        {#if me && motion.stage === "resolved" && motion.outcome === "passed"}
            {#if !showDissentForm}
                <button class="btn-dissent" onclick={() => showDissentForm = true}>Record minority statement</button>
            {:else}
                <div class="dissent-form">
                    <textarea class="input textarea" placeholder="State your dissent…" bind:value={dissentText} rows="3"></textarea>
                    <div class="dissent-form-btns">
                        <button class="btn-primary" onclick={doDissent} disabled={submittingDissent || !dissentText.trim()}>
                            {submittingDissent ? "Saving…" : "Submit dissent"}
                        </button>
                        <button class="btn-ghost" onclick={() => { showDissentForm = false; dissentText = ""; }}>Cancel</button>
                    </div>
                </div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    @media (min-width: 768px) { .page { padding-bottom: 2rem; } }

    .back-btn {
        background: none; border: none; cursor: pointer;
        font-size: 0.82rem; color: #64748b; padding: 0;
        align-self: flex-start;
    }

    .header-row {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
    }

    .title { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0; flex: 1; }

    .meta-row {
        display: flex; gap: 1rem; font-size: 0.78rem; color: #64748b; flex-wrap: wrap;
    }

    .threshold-note { font-size: 0.78rem; color: #64748b; margin: 0; }

    .description {
        font-size: 0.9rem; color: #334155; line-height: 1.6;
        background: #f8fafc; border: 1px solid #e2e8f0;
        border-radius: 0.75rem; padding: 0.9rem 1rem;
    }

    /* ── Outcome banner ──────────────────────────────────────────────────────── */
    .outcome-banner {
        border-radius: 0.75rem; padding: 0.85rem 1rem;
        background: #f1f5f9; border: 1px solid #e2e8f0;
    }
    .outcome-banner.outcome-pass { background: #dcfce7; border-color: #86efac; }
    .outcome-banner.outcome-fail { background: #fee2e2; border-color: #fca5a5; }
    .outcome-label { font-weight: 700; font-size: 0.82rem; letter-spacing: 0.05em; }
    .outcome-note  { font-size: 0.85rem; color: #334155; margin: 0.3rem 0 0; }
    .outcome-date  { font-size: 0.75rem; color: #64748b; margin: 0.25rem 0 0; }

    /* ── Vote summary ────────────────────────────────────────────────────────── */
    .vote-summary { display: flex; flex-direction: column; gap: 0.4rem; }
    .vote-bar-wrap { border-radius: 9999px; background: #fee2e2; overflow: hidden; height: 8px; }
    .vote-bar      { height: 100%; position: relative; }
    .bar-approve   { height: 100%; background: #16a34a; border-radius: 9999px; transition: width 0.3s; }
    .vote-counts   { display: flex; gap: 1rem; font-size: 0.78rem; }
    .vc-approve    { color: #15803d; font-weight: 600; }
    .vc-reject     { color: #b91c1c; font-weight: 600; }
    .vc-total      { color: #64748b; }

    /* ── Vote actions ────────────────────────────────────────────────────────── */
    .vote-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .btn-approve { padding: 0.55rem 1.1rem; background: #dcfce7; color: #15803d; border: 1px solid #86efac; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; }
    .btn-reject  { padding: 0.55rem 1.1rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; }
    .btn-abstain { padding: 0.55rem 1.1rem; background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; }

    .my-vote { font-size: 0.82rem; color: #64748b; margin: 0; }

    /* ── Action buttons ──────────────────────────────────────────────────────── */
    .btn-action {
        padding: 0.5rem 1rem; background: #f0fdf4; border: 1px solid #86efac;
        border-radius: 0.5rem; color: #15803d; font-size: 0.875rem; font-weight: 600;
        cursor: pointer; align-self: flex-start;
    }

    .btn-primary {
        padding: 0.5rem 1rem; background: #16a34a; color: #fff; border: none;
        border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-ghost {
        padding: 0.5rem 0.9rem; background: none; border: 1px solid #e2e8f0;
        border-radius: 0.5rem; font-size: 0.875rem; color: #64748b; cursor: pointer;
    }

    .btn-withdraw {
        padding: 0.45rem 0.9rem; background: none; border: 1px solid #fca5a5;
        border-radius: 0.5rem; font-size: 0.8rem; color: #b91c1c; cursor: pointer;
        align-self: flex-start;
    }

    /* ── Clerk actions ───────────────────────────────────────────────────────── */
    .clerk-actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }

    .outcome-form { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 360px; }
    .outcome-form-btns { display: flex; gap: 0.5rem; }

    /* ── Comments ────────────────────────────────────────────────────────────── */
    .divider  { border: none; border-top: 1px solid #e2e8f0; margin: 0.25rem 0; }
    .section-heading { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0; }

    .comment {
        padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
    }
    .comment-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
    .comment-author { font-size: 0.8rem; font-weight: 600; color: #0f172a; }
    .comment-date   { font-size: 0.72rem; color: #94a3b8; margin-left: auto; }
    .comment-body   { font-size: 0.875rem; color: #334155; margin: 0; line-height: 1.5; }

    .comment-kind { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
    .comment-kind-evidence  { background: #d1fae5; color: #065f46; }
    .comment-kind-challenge { background: #fef3c7; color: #92400e; }

    .comment-kind-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .comment-kind-label { font-size: 0.75rem; color: #64748b; font-weight: 500; white-space: nowrap; }
    .comment-kind-btns { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .kind-btn {
        font-size: 0.75rem; padding: 0.2rem 0.55rem; border-radius: 6px;
        border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; color: #64748b;
    }
    .kind-btn.kind-active { border-color: #16a34a; background: #dcfce7; color: #15803d; font-weight: 600; }

    .comment-form { display: flex; flex-direction: column; gap: 0.5rem; }
    .comment-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin: 0.5rem 0;
    }
    .page-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 0.25rem 0.65rem;
        font-size: 0.8rem;
        cursor: pointer;
    }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .page-info { font-size: 0.8rem; color: #64748b; }

    /* ── Vote list ───────────────────────────────────────────────────────────── */
    .votes-detail { font-size: 0.8rem; color: #64748b; }
    .votes-detail summary { cursor: pointer; font-weight: 600; padding: 0.3rem 0; }
    .vote-row { display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid #f1f5f9; }
    .vote-handle { color: #334155; }
    .vote-approve { color: #15803d; font-weight: 600; }
    .vote-reject  { color: #b91c1c; font-weight: 600; }
    .vote-abstain { color: #64748b; }

    /* ── Structured reasoning ────────────────────────────────────────────────── */
    .reasoning-block { display: flex; flex-direction: column; gap: 0.6rem; border-left: 3px solid #e2e8f0; padding-left: 0.85rem; }
    .reasoning-item { display: flex; flex-direction: column; gap: 0.15rem; }
    .reasoning-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
    .reasoning-body { font-size: 0.85rem; color: #334155; margin: 0; line-height: 1.55; }

    /* ── Dissents ─────────────────────────────────────────────────────────────── */
    .dissent {
        padding: 0.75rem 1rem; background: #fefce8; border: 1px solid #fde68a;
        border-radius: 0.75rem;
    }
    .dissent-header { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
    .dissent-author { font-size: 0.8rem; font-weight: 600; color: #92400e; }
    .dissent-date   { font-size: 0.72rem; color: #a16207; }
    .dissent-body   { font-size: 0.875rem; color: #78350f; margin: 0; line-height: 1.5; }

    .btn-dissent {
        align-self: flex-start; font-size: 0.8rem; padding: 0.35rem 0.8rem;
        background: none; border: 1px solid #d97706; color: #b45309;
        border-radius: 6px; cursor: pointer;
    }
    .btn-dissent:hover { background: #fef3c7; }

    .dissent-form { display: flex; flex-direction: column; gap: 0.5rem; }
    .dissent-form-btns { display: flex; gap: 0.5rem; }

    /* ── Inputs ──────────────────────────────────────────────────────────────── */
    .input {
        padding: 0.55rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem;
        font-size: 0.875rem; background: #fff; outline: none; font-family: inherit;
        width: 100%; box-sizing: border-box;
    }
    .input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px #dcfce7; }
    .textarea { resize: vertical; min-height: 70px; }
    .select { cursor: pointer; }

    /* ── Badges ──────────────────────────────────────────────────────────────── */
    .badge {
        font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.55rem;
        border-radius: 9999px; white-space: nowrap; flex-shrink: 0;
    }
    .badge-voting       { background: #dbeafe; color: #1d4ed8; }
    .badge-deliberating { background: #fef9c3; color: #854d0e; }
    .badge-passed       { background: #dcfce7; color: #15803d; }
    .badge-failed       { background: #fee2e2; color: #b91c1c; }
    .badge-resolved     { background: #f1f5f9; color: #64748b; }
    .badge-default      { background: #f1f5f9; color: #64748b; }

    /* ── Utility ─────────────────────────────────────────────────────────────── */
    .skeleton.tall { height: 10rem; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 0.75rem; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .error-msg { font-size: 0.875rem; color: #dc2626; padding: 0.75rem 1rem; background: #fef2f2; border-radius: 0.5rem; margin: 0; }
    .empty-msg { font-size: 0.875rem; color: #64748b; margin: 0; }
</style>
