<script lang="ts">
    import { listPersons, getPerson, setPassword, grantAdmin, revokeAdmin, grantPersonApp, revokePersonApp } from "../lib/api.js";
    import type { PersonDto } from "../lib/api.js";
    import { session } from "../lib/session.js";

    const PAGE_SIZE = 25;

    let members: PersonDto[] = $state([]);
    let loading = $state(true);
    let error = $state("");
    let query = $state("");
    let page = $state(1);

    // ── Expand / reset state ───────────────────────────────────────────────────
    let expandedId: string | null = $state(null);
    let expandedDetail: PersonDto | null = $state(null);
    let detailLoading = $state(false);
    let newPass    = $state("");
    let resetError = $state("");
    let resetOk    = false;
    let resetting  = $state(false);
    let adminError = $state("");
    let adminWorking = $state(false);

    // ── App access state ──────────────────────────────────────────────────────
    let appAccessWorking = $state(false);
    let appAccessError = $state("");
    const ALL_APPS = ["bank", "market", "mail"];

    async function load() {
        loading = true;
        error = "";
        try {
            members = (await listPersons()).sort((a, b) =>
                a.handle.localeCompare(b.handle)
            );
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load directory";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    const filtered = $derived(
        query.trim()
            ? members.filter(m =>
                m.handle.includes(query.toLowerCase()) ||
                `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase())
              )
            : members
    );

    const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const paginated  = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

    async function toggleExpand(handle: string) {
        const newHandle = expandedId === handle ? null : handle;
        expandedId = newHandle;
        expandedDetail = null;
        newPass    = "";
        resetError = "";
        resetOk    = false;
        adminError = "";
        if (newHandle) {
            detailLoading = true;
            try { expandedDetail = await getPerson(newHandle); } catch { /* keep null */ }
            finally { detailLoading = false; }
        }
    }

    async function doResetPassword(handle: string) {
        if (newPass.length < 8) { resetError = "Password must be at least 8 characters"; return; }
        resetting = true; resetError = ""; resetOk = false;
        try {
            await setPassword(handle, newPass);
            resetOk = true;
            newPass = "";
        } catch (e) {
            resetError = e instanceof Error ? e.message : "Failed to reset password";
        } finally {
            resetting = false;
        }
    }

    async function doGrantAdmin(handle: string) {
        adminWorking = true; adminError = "";
        try {
            const updated = await grantAdmin(handle);
            members = members.map(m => m.handle === handle ? updated : m);
        } catch (e) {
            adminError = e instanceof Error ? e.message : "Failed to grant admin access";
        } finally {
            adminWorking = false;
        }
    }

    async function doRevokeAdmin(handle: string) {
        adminWorking = true; adminError = "";
        try {
            const updated = await revokeAdmin(handle);
            members = members.map(m => m.handle === handle ? updated : m);
        } catch (e) {
            adminError = e instanceof Error ? e.message : "Failed to revoke admin access";
        } finally {
            adminWorking = false;
        }
    }

    async function doGrantApp(handle: string, app: string) {
        appAccessWorking = true; appAccessError = "";
        try {
            const updated = await grantPersonApp(handle, app);
            members = members.map(m => m.handle === handle ? updated : m);
            expandedDetail = updated;
        } catch (e) {
            appAccessError = e instanceof Error ? e.message : "Failed to grant access";
        } finally {
            appAccessWorking = false;
        }
    }

    async function doRevokeApp(handle: string, app: string) {
        appAccessWorking = true; appAccessError = "";
        try {
            const updated = await revokePersonApp(handle, app);
            members = members.map(m => m.handle === handle ? updated : m);
            expandedDetail = updated;
        } catch (e) {
            appAccessError = e instanceof Error ? e.message : "Failed to revoke access";
        } finally {
            appAccessWorking = false;
        }
    }
</script>

<div class="directory-page">
    <div class="page-header">
        <h2 class="page-title">Directory</h2>
    </div>

    <div class="search-row">
        <input
            type="search"
            bind:value={query}
            oninput={() => { page = 1; }}
            placeholder="Search by name or handle…"
            autocomplete="off"
            autocapitalize="none"
        />
    </div>

    {#if loading}
        <div class="loading-msg">Loading…</div>
    {:else if error}
        <div class="loading-msg">{error}</div>
    {:else if filtered.length === 0}
        <div class="loading-msg">No members found.</div>
    {:else}
        <div class="member-list">
            {#each paginated as m (m.handle)}
                <div class="member-card" class:expanded={expandedId === m.handle}>
                    <button class="member-row" onclick={() => toggleExpand(m.handle)}>
                        <div class="member-avatar">{m.firstName[0]}{m.lastName[0]}</div>
                        <div class="member-info">
                            <span class="member-name">{m.firstName} {m.lastName}</span>
                            <span class="member-handle">{m.handle}</span>
                        </div>
                        {#if m.isAdmin}
                            <span class="badge admin">Admin</span>
                        {/if}
                        {#if m.retired}
                            <span class="badge retired">Retired</span>
                        {:else if m.disabled}
                            <span class="badge exempt">Exempt</span>
                        {/if}
                        <span class="chevron">{expandedId === m.handle ? "▲" : "▼"}</span>
                    </button>

                    {#if expandedId === m.handle}
                        <div class="member-detail">
                            {#if expandedDetail?.phone}
                                <p class="detail-phone">📞 {expandedDetail.phone}</p>
                            {:else if m.phone}
                                <p class="detail-phone">📞 {m.phone}</p>
                            {/if}

                            {#if detailLoading}
                                <p class="detail-loading">Loading…</p>
                            {/if}

                            {#if $session?.isAdmin && expandedDetail?.appPermissions}
                                {@const perms = expandedDetail.appPermissions}
                                {@const apps = Object.keys(perms).sort()}
                                {@const levels = [...new Set(apps.flatMap(a => perms[a]))].sort((a, b) => a === "member" ? -1 : b === "member" ? 1 : a.localeCompare(b))}
                                {#if apps.length > 0}
                                    <div class="perms-section">
                                        <p class="reset-label">Permissions</p>
                                        <table class="perms-table">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    {#each levels as level}
                                                        <th class="perms-th">{level}</th>
                                                    {/each}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each apps as app}
                                                    <tr>
                                                        <td class="perms-app">{app}</td>
                                                        {#each levels as level}
                                                            <td class="perms-cell">
                                                                {#if perms[app].includes(level)}
                                                                    <span class="perm-dot perm-{level}">✓</span>
                                                                {:else}
                                                                    <span class="perm-dot perm-none">–</span>
                                                                {/if}
                                                            </td>
                                                        {/each}
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>
                                {/if}
                            {/if}

                            {#if $session?.isAdmin}
                                <div class="app-access-section">
                                    <p class="reset-label">App access</p>
                                    <div class="app-access-row">
                                        {#each ALL_APPS as app}
                                            {@const enrolled = (expandedDetail ?? m).apps?.includes(app) ?? false}
                                            <button
                                                class="app-toggle"
                                                class:enrolled
                                                onclick={() => enrolled ? doRevokeApp(m.handle, app) : doGrantApp(m.handle, app)}
                                                disabled={appAccessWorking}
                                                title={enrolled ? `Remove ${app} access` : `Grant ${app} access`}
                                            >{app}</button>
                                        {/each}
                                    </div>
                                    {#if appAccessError}<p class="reset-error">{appAccessError}</p>{/if}
                                </div>
                            {/if}

                            {#if $session?.isAdmin}
                                <div class="reset-section">
                                    <p class="reset-label">Reset password</p>
                                    <div class="reset-row">
                                        <input
                                            type="password"
                                            bind:value={newPass}
                                            placeholder="New password (min 8 chars)"
                                            autocomplete="new-password"
                                            disabled={resetting}
                                            onkeydown={(e) => e.key === "Enter" && doResetPassword(m.handle)}
                                        />
                                        <button
                                            class="btn-reset"
                                            onclick={() => doResetPassword(m.handle)}
                                            disabled={resetting || newPass.length < 8}
                                        >
                                            {resetting ? "…" : "Set"}
                                        </button>
                                    </div>
                                    {#if resetError}<p class="reset-error">{resetError}</p>{/if}
                                    {#if resetOk}<p class="reset-ok">Password reset ✓</p>{/if}
                                </div>
                                <div class="admin-section">
                                    {#if adminError}<p class="reset-error">{adminError}</p>{/if}
                                    {#if m.admin}
                                        <button
                                            class="btn-admin-revoke"
                                            onclick={() => doRevokeAdmin(m.handle)}
                                            disabled={adminWorking}
                                        >
                                            {adminWorking ? "…" : "Remove admin grant"}
                                        </button>
                                        {#if !m.isAdmin}
                                            <p class="admin-note">Not yet admin by seniority — grant can be removed.</p>
                                        {/if}
                                    {:else if !m.isAdmin}
                                        <button
                                            class="btn-admin-grant"
                                            onclick={() => doGrantAdmin(m.handle)}
                                            disabled={adminWorking}
                                        >
                                            {adminWorking ? "…" : "Make admin"}
                                        </button>
                                    {:else}
                                        <p class="admin-note">Admin by seniority.</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
        {#if totalPages > 1}
            <div class="pagination">
                <button
                    class="page-btn"
                    onclick={() => { page = Math.max(1, page - 1); }}
                    disabled={page === 1}
                >← Prev</button>
                <span class="page-info">Page {page} of {totalPages}</span>
                <button
                    class="page-btn"
                    onclick={() => { page = Math.min(totalPages, page + 1); }}
                    disabled={page === totalPages}
                >Next →</button>
            </div>
        {/if}
        <div class="count">
            {#if totalPages > 1}
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} member{filtered.length !== 1 ? "s" : ""}
            {:else}
                {filtered.length} member{filtered.length !== 1 ? "s" : ""}
            {/if}
        </div>
    {/if}
</div>

<style>
    .directory-page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 480px;
        margin: 0 auto;
    }

    @media (min-width: 768px) {
        .directory-page { padding-bottom: 2rem; max-width: 800px; }
        .member-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        .member-card:nth-last-child(-n+2) > .member-row { border-bottom: none; }
        .member-card:nth-child(odd):not(:last-child) > .member-row { border-right: 1px solid #f1f5f9; }
    }

    .page-title { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin: 0 0 1rem; }

    .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .page-header .page-title { margin: 0; }

    .btn-add {
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
    }

    .search-row { margin-bottom: 1.25rem; }

    input[type="search"] {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 0.95rem;
        padding: 0.65rem 1rem;
        outline: none;
        transition: border-color 0.15s;
    }

    input[type="search"]:focus { border-color: #16a34a; }

    .member-list {
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow: hidden;
    }

    .member-row {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.75rem 1.25rem;
        border-bottom: 1px solid #f1f5f9;
        width: 100%;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        text-align: left;
        cursor: pointer;
        font-family: inherit;
    }

    .member-row:hover { background: #f8fafc; }
    .member-card:last-child > .member-row { border-bottom: none; }
    .member-card.expanded > .member-row { border-bottom: 1px solid #f1f5f9; }

    .member-avatar {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        background: #dcfce7;
        color: #15803d;
        font-size: 0.85rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .member-info { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; }

    .member-name   { font-size: 0.9rem; font-weight: 600; color: #0f172a; }
    .member-handle { font-size: 0.75rem; color: #94a3b8; }

    .badge {
        font-size: 0.7rem;
        font-weight: 600;
        border-radius: 99px;
        padding: 0.2rem 0.55rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .badge.retired { background: #ede9fe; color: #7c3aed; }
    .badge.exempt  { background: #fef3c7; color: #d97706; }
    .badge.admin { background: #dbeafe; color: #1d4ed8; }

    .chevron { font-size: 0.6rem; color: #cbd5e1; margin-left: auto; flex-shrink: 0; }

    /* ── Expanded detail panel ── */
    .member-detail {
        padding: 0.85rem 1.25rem 1rem;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
    }

    .detail-phone {
        font-size: 0.85rem;
        color: #475569;
        margin: 0 0 0.75rem;
    }

    .reset-section { margin-bottom: 0; }

    .perms-section { margin-bottom: 1rem; }

    .perms-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
    }

    .perms-th {
        text-align: center;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        padding: 0 0.5rem 0.35rem;
    }

    .perms-app {
        color: #475569;
        font-weight: 500;
        padding: 0.25rem 0.75rem 0.25rem 0;
        white-space: nowrap;
    }

    .perms-cell { text-align: center; padding: 0.25rem 0.5rem; }

    .perm-dot {
        font-size: 0.78rem;
        font-weight: 700;
    }

    .perm-dot.perm-member { color: #16a34a; }
    .perm-dot.perm-admin  { color: #1d4ed8; }
    .perm-dot.perm-none   { color: #e2e8f0; }

    .app-access-section { margin-bottom: 1rem; }

    .app-access-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .app-toggle {
        padding: 0.3rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #64748b;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .app-toggle.enrolled {
        background: #dcfce7;
        border-color: #86efac;
        color: #166534;
    }

    .app-toggle:hover:not(:disabled) {
        border-color: #94a3b8;
        color: #1e293b;
    }

    .app-toggle.enrolled:hover:not(:disabled) {
        background: #fef2f2;
        border-color: #fca5a5;
        color: #991b1b;
    }

    .reset-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin: 0 0 0.45rem;
    }

    .reset-row {
        display: flex;
        gap: 0.5rem;
    }

    .reset-row input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.9rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
    }

    .reset-row input:focus { border-color: #16a34a; }

    .btn-reset {
        padding: 0.5rem 0.9rem;
        background: #0f172a;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
    }

    .btn-reset:hover:not(:disabled) { background: #1e293b; }
    .btn-reset:disabled { opacity: 0.4; cursor: not-allowed; }

    .reset-error { font-size: 0.82rem; color: #dc2626; margin: 0.4rem 0 0; }
    .reset-ok    { font-size: 0.82rem; color: #16a34a; margin: 0.4rem 0 0; font-weight: 600; }

    .admin-section { margin-top: 0.75rem; }

    .admin-note {
        font-size: 0.8rem;
        color: #94a3b8;
        margin: 0.35rem 0 0;
    }

    .btn-admin-grant {
        font-size: 0.82rem;
        font-weight: 600;
        padding: 0.4rem 0.85rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        background: #dbeafe;
        color: #1d4ed8;
        transition: background 0.15s;
    }
    .btn-admin-grant:hover:not(:disabled) { background: #bfdbfe; }

    .btn-admin-revoke {
        font-size: 0.82rem;
        font-weight: 600;
        padding: 0.4rem 0.85rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        background: #fee2e2;
        color: #b91c1c;
        transition: background 0.15s;
    }
    .btn-admin-revoke:hover:not(:disabled) { background: #fecaca; }
    .btn-admin-grant:disabled,
    .btn-admin-revoke:disabled { opacity: 0.4; cursor: not-allowed; }

    .count { text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem; }

    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 1rem;
    }

    .page-btn {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.45rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: #0f172a;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }

    .page-btn:hover:not(:disabled) { background: #f0fdf4; border-color: #16a34a; }
    .page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    .page-info {
        font-size: 0.85rem;
        color: #475569;
        white-space: nowrap;
    }

    /* ── App permissions ───────────────────────────────────────────────────────────────── */

    .btn-cancel {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.6rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: #f1f5f9;
        color: #64748b;
        white-space: nowrap;
    }

    .detail-loading { font-size: 0.82rem; color: #94a3b8; margin: 0 0 0.75rem; }
</style>
