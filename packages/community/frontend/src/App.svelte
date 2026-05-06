<script lang="ts">
    import { onMount } from "svelte";
    import { session, currentPage } from "./lib/session.js";
    import { getSetupStatus } from "./lib/api.js";
    import SetupPage       from "./pages/SetupPage.svelte";
    import LoginPage       from "./pages/LoginPage.svelte";
    import DirectoryPage   from "./pages/DirectoryPage.svelte";
    import ConstitutionPage from "./pages/ConstitutionPage.svelte";
    import DocumentsPage   from "./pages/DocumentsPage.svelte";
    import BylawPage       from "./pages/BylawPage.svelte";
    import SectionPage     from "./pages/SectionPage.svelte";
    import SettingsPage        from "./pages/SettingsPage.svelte";
    import CentralBankPage     from "./pages/CentralBankPage.svelte";
    import SocialInsurancePage from "./pages/SocialInsurancePage.svelte";
    import DomainsPage      from "./pages/DomainsPage.svelte";
    import DomainPage      from "./pages/DomainPage.svelte";
    import UnitPage        from "./pages/UnitPage.svelte";
    import LeadershipPage    from "./pages/LeadershipPage.svelte";
import AssemblyPage      from "./pages/AssemblyPage.svelte";
import PoolPage          from "./pages/PoolPage.svelte";
import MotionPage        from "./pages/MotionPage.svelte";
    import CharterPage         from "./pages/CharterPage.svelte";
    import BudgetPage          from "./pages/BudgetPage.svelte";
    import AssociationsPage    from "./pages/AssociationsPage.svelte";
    import AssociationPage     from "./pages/AssociationPage.svelte";
    import AddPersonPage       from "./pages/AddPersonPage.svelte";
    import LocationsPage       from "./pages/LocationsPage.svelte";
    import ProposalsPage       from "./pages/ProposalsPage.svelte";
    import ProposePage         from "./pages/ProposePage.svelte";
    import ApplyPage           from "./pages/ApplyPage.svelte";
    import NodesPage           from "./pages/NodesPage.svelte";
    import VacanciesPage       from "./pages/VacanciesPage.svelte";
    import VacancyDetailPage   from "./pages/VacancyDetailPage.svelte";
    import ConnectionsPage     from "./pages/ConnectionsPage.svelte";
    import SchedulePage        from "./pages/SchedulePage.svelte";
    import TimelinePage        from "./pages/TimelinePage.svelte";
    import DashboardPage       from "./pages/DashboardPage.svelte";
    import CalendarPage        from "./pages/CalendarPage.svelte";
    import BottomNav           from "./components/BottomNav.svelte";
    import RegistryPage        from "./pages/RegistryPage.svelte";
    import RoleTypePage        from "./pages/RoleTypePage.svelte";
    import UnitTypePage        from "./pages/UnitTypePage.svelte";

    type AppState = "loading" | "setup" | "login" | "apply" | "app";
    let appState: AppState = $state("loading");

    onMount(async () => {
        // If a satellite app redirected here with ?return=<url> and the user is
        // already logged in (persisted in localStorage), hand the session back
        // immediately without showing the login page.
        const returnUrl = new URLSearchParams(window.location.search).get("return");
        if (returnUrl && $session && (returnUrl.startsWith("http://") || returnUrl.startsWith("https://"))) {
            const payload = btoa(encodeURIComponent(JSON.stringify({
                token:     $session.token,
                id:        $session.personId,
                firstName: $session.firstName,
                lastName:  $session.lastName,
                handle:    $session.handle,
            })));
            window.location.href = `${returnUrl}#session=${payload}`;
            return;
        }

        try {
            const { needsSetup } = await getSetupStatus();
            if (needsSetup) {
                // Wipe any stale session from a previous community
                session.logout();
                appState = "setup";
            } else if ($session) {
                appState = "app";
            } else {
                appState = "login";
            }
        } catch {
            // If status check fails, fall through to login
            appState = $session ? "app" : "login";
        }
    });
</script>

{#if appState === "loading"}
    <div class="splash">
        <div class="splash-logo">⊚</div>
    </div>

{:else if appState === "setup"}
    <SetupPage onComplete={() => { appState = "login"; }} />

{:else if appState === "apply"}
    <ApplyPage onBack={() => { appState = "login"; }} />

{:else if appState === "login"}
    <LoginPage onApply={() => { appState = "apply"; }} onLogin={() => { appState = "app"; }} />

{:else if appState === "app"}
    <main>
        {#if $currentPage === "dashboard"}
            <DashboardPage />
        {:else if $currentPage === "directory"}
            <DirectoryPage />
        {:else if $currentPage === "constitution"}
            <ConstitutionPage />
        {:else if $currentPage === "documents"}
            <DocumentsPage />
        {:else if $currentPage === "bylaw"}
            <BylawPage />
        {:else if $currentPage === "section"}
            <SectionPage />
        {:else if $currentPage === "settings"}
            <SettingsPage />
        {:else if $currentPage === "domains"}
            <DomainsPage />
        {:else if $currentPage === "domain"}
            <DomainPage />
        {:else if $currentPage === "unit"}
            <UnitPage />
        {:else if $currentPage === "leadership"}
            <LeadershipPage />
        {:else if $currentPage === "assembly"}
            <AssemblyPage />
        {:else if $currentPage === "pool"}
            <PoolPage />
        {:else if $currentPage === "motion"}
            <MotionPage />
        {:else if $currentPage === "charter"}
            <CharterPage />
        {:else if $currentPage === "budget"}
            <BudgetPage />
        {:else if $currentPage === "associations"}
            <AssociationsPage />
        {:else if $currentPage === "association"}
            <AssociationPage />
        {:else if $currentPage === "add-person"}
            <AddPersonPage />
        {:else if $currentPage === "locations"}
            <LocationsPage />
        {:else if $currentPage === "proposals"}
            <ProposalsPage />
        {:else if $currentPage === "propose"}
            <ProposePage />
        {:else if $currentPage === "nodes"}
            <NodesPage />
        {:else if $currentPage === "central-bank"}
            <CentralBankPage />
        {:else if $currentPage === "social-insurance"}
            <SocialInsurancePage />
        {:else if $currentPage === "vacancies"}
            <VacanciesPage />
        {:else if $currentPage === "vacancy-detail"}
            <VacancyDetailPage />
        {:else if $currentPage === "connections"}
            <ConnectionsPage />
        {:else if $currentPage === "schedule"}
            <SchedulePage />
        {:else if $currentPage === "calendar"}
            <CalendarPage />
        {:else if $currentPage === "timeline"}
            <TimelinePage />
        {:else if $currentPage === "registry"}
            <RegistryPage />
        {:else if $currentPage === "role-type"}
            <RoleTypePage />
        {:else if $currentPage === "unit-type-detail"}
            <UnitTypePage />
        {/if}
    </main>
    <BottomNav />
{/if}

<style>
    :global(*, *::before, *::after) { box-sizing: border-box; }

    :global(body) {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #f0fdf4;
        color: #0f172a;
        -webkit-font-smoothing: antialiased;
    }

    main {
        min-height: 100dvh;
    }

    @media (min-width: 768px) {
        main { margin-left: 220px; }
    }

    .splash {
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0fdf4;
    }

    .splash-logo {
        font-size: 3rem;
        animation: pulse 1.4s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
</style>
