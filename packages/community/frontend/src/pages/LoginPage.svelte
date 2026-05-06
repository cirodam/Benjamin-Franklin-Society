<script lang="ts">
    import ErrorBanner from "../components/ErrorBanner.svelte";
    import { session, currentPage, sessionExpired } from "../lib/session.js";
    import { login, changeOwnPassword, getConstitution } from "../lib/api.js";
    import type { PersonDto } from "../lib/api.js";

    const { onApply, onLogin }: { onApply?: () => void; onLogin?: () => void } = $props();

    let communityName = $state("");
    $effect(() => { getConstitution().then(c => { communityName = c.meta.communityName; }).catch(() => {}); });

    let handle   = $state("");
    let password = $state("");
    let error    = $state("");
    let loading  = $state(false);

    // Must-change-password step
    let mustChange      = $state(false);
    let pendingPerson:  (PersonDto & { token: string }) | null = $state(null);
    let newPassword     = $state("");
    let confirmPassword = $state("");
    let changeError     = $state("");
    let changeLoading   = $state(false);

    // Other ECF services redirect here with ?return=<origin> after which we
    // hand the credential back via a hash fragment so it never hits a server.
    const returnUrl = new URLSearchParams(window.location.search).get("return");

    async function submit() {
        error = "";
        if (!handle.trim())   { error = "Enter your handle"; return; }
        if (!password)        { error = "Enter your password"; return; }
        sessionExpired.set(false);

        loading = true;
        try {
            const person = await login(handle.trim().toLowerCase(), password);

            if (person.mustChangePassword) {
                // Log in so subsequent API calls have a token, then intercept.
                session.login(person);
                pendingPerson = person;
                mustChange = true;
                return;
            }

            if (returnUrl && (returnUrl.startsWith("http://") || returnUrl.startsWith("https://"))) {
                // Hand the session payload back to the requesting service via
                // the URL fragment (never sent to the server).
                // Encode as encodeURIComponent→btoa so non-ASCII names (accented
                // characters etc.) survive the base64 round-trip safely.
                const payload = btoa(encodeURIComponent(JSON.stringify({
                    token:     person.token,
                    id:        person.id,
                    firstName: person.firstName,
                    lastName:  person.lastName,
                    handle:    person.handle,
                })));
                window.location.href = `${returnUrl}#session=${payload}`;
            } else {
                session.login(person);
                onLogin?.();
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Login failed";
        } finally {
            loading = false;
        }
    }

    async function submitPasswordChange() {
        changeError = "";
        if (newPassword.length < 8)              { changeError = "Password must be at least 8 characters"; return; }
        if (newPassword !== confirmPassword)      { changeError = "Passwords do not match"; return; }
        changeLoading = true;
        try {
            await changeOwnPassword(newPassword);
            // Proceed normally after changing password
            if (returnUrl && (returnUrl.startsWith("http://") || returnUrl.startsWith("https://"))) {
                const p = pendingPerson!;
                const payload = btoa(encodeURIComponent(JSON.stringify({
                    token:     p.token,
                    id:        p.id,
                    firstName: p.firstName,
                    lastName:  p.lastName,
                    handle:    p.handle,
                })));
                window.location.href = `${returnUrl}#session=${payload}`;
            } else {
                currentPage.go("profile");
                onLogin?.();
            }
        } catch (e) {
            changeError = e instanceof Error ? e.message : "Failed to change password";
        } finally {
            changeLoading = false;
        }
    }
</script>

<div class="login-page">
    <header class="login-header">
        <div class="logo">⊚</div>
        <h1>{communityName || "Community Portal"}</h1>
        <p>{mustChange ? "Set your password" : "Sign in with your handle"}</p>
    </header>

    <div class="login-body">
        {#if mustChange}
            <p class="must-change-notice">Your account uses a temporary password. Choose a new password to continue.</p>
            <ErrorBanner message={changeError} />
            <form onsubmit={(e) => { e.preventDefault(); submitPasswordChange(); }}>
                <label class="field">
                    <span>New password</span>
                    <input
                        type="password"
                        bind:value={newPassword}
                        autocomplete="new-password"
                        disabled={changeLoading}
                    />
                </label>
                <label class="field">
                    <span>Confirm password</span>
                    <input
                        type="password"
                        bind:value={confirmPassword}
                        autocomplete="new-password"
                        disabled={changeLoading}
                    />
                </label>
                <button type="submit" class="btn-primary" disabled={changeLoading}>
                    {changeLoading ? "Saving…" : "Set password"}
                </button>
            </form>
    {:else}
            {#if $sessionExpired}
                <div class="session-notice">Your session expired. Please sign in again.</div>
            {/if}
            <ErrorBanner message={error} />

            <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
                <label class="field">
                    <span>Handle</span>
                    <div class="handle-input">
                        <input
                            type="text"
                            bind:value={handle}
                            placeholder="your_handle"
                            autocomplete="username"
                            autocapitalize="none"
                            spellcheck={false}
                            disabled={loading}
                        />
                    </div>
                </label>

                <label class="field">
                    <span>Password</span>
                    <input
                        type="password"
                        bind:value={password}
                        autocomplete="current-password"
                        disabled={loading}
                    />
                </label>

                <button type="submit" class="btn-primary" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                </button>
            </form>

            {#if onApply}
                <p class="apply-link">
                    Not a member yet?
                    <button class="link-btn" onclick={onApply}>Apply to join</button>
                </p>
            {/if}
        {/if}
    </div>
</div>

<style>
    .login-page {
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #f0fdf4;
        padding: 0 1.5rem;
    }

    .login-header {
        text-align: center;
        padding: 3.5rem 0 2rem;
    }

    .logo { font-size: 3rem; margin-bottom: 0.5rem; }

    .login-header h1 {
        font-size: 1.7rem;
        font-weight: 700;
        color: #14532d;
        margin: 0;
    }

    .login-header p {
        color: #4ade80;
        margin: 0.4rem 0 0;
        color: #166534;
    }

    .login-body {
        width: 100%;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.4rem; }

    .field > span { font-size: 0.85rem; font-weight: 500; color: #374151; }

    .handle-input {
        display: flex;
        align-items: center;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
        transition: border-color 0.15s;
    }

    .handle-input:focus-within { border-color: #16a34a; }

    .handle-input input {
        border: none;
        outline: none;
        font-size: 1rem;
        padding: 0.75rem 1rem 0.75rem 0;
        flex: 1;
        background: transparent;
    }

    .field input[type="password"] {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 1rem;
        padding: 0.75rem 1rem;
        outline: none;
        transition: border-color 0.15s;
        width: 100%;
        box-sizing: border-box;
    }

    .field input[type="password"]:focus { border-color: #16a34a; }

    .btn-primary {
        width: 100%;
        padding: 0.9rem;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        margin-top: 0.25rem;
        transition: background 0.15s;
    }

    .btn-primary:disabled { background: #86efac; cursor: default; }
    .btn-primary:not(:disabled):active { background: #15803d; }

    .apply-link {
        text-align: center;
        font-size: 0.9rem;
        color: #64748b;
        margin: 0;
    }

    .must-change-notice {
        background: #fef9c3;
        border: 1px solid #fde68a;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        color: #713f12;
        margin: 0;
    }

    .session-notice {
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        color: #9a3412;
        margin-bottom: 0.5rem;
    }

    .link-btn {
        background: none;
        border: none;
        color: #16a34a;
        font-size: inherit;
        cursor: pointer;
        padding: 0;
        font-weight: 500;
        text-decoration: underline;
    }
</style>
