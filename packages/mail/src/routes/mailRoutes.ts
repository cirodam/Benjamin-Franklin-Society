import { Router } from "express";
import { requireAuth, requireModerator, requireMailAccess } from "./middleware.js";
import {
    listPersons,
    listThreadsFiltered,
    getThread,
    getInbox,
    getOutbox,
    getUnreadCount,
    sendMessage,
    markRead,
    deleteMessage,
    receiveExternalMessage,
    reportMessage,
    adminListReports,
    adminDeleteMessage,
    listDrafts,
    saveDraft,
    deleteDraft,
    archiveThread,
    searchMessages,
    getTrash,
    restoreMessage,
    permanentDeleteMessage,
    emptyTrash,
} from "./MailController.js";

const router = Router();

// All mail routes require authentication
router.get(   "/persons",                ...requireMailAccess, listPersons);
router.get(   "/threads",                ...requireMailAccess, listThreadsFiltered);
router.get(   "/threads/:id",            ...requireMailAccess, getThread);
router.patch( "/threads/:id/archive",    ...requireMailAccess, archiveThread);
router.get(   "/inbox",                  ...requireMailAccess, getInbox);
router.get(   "/outbox",                 ...requireMailAccess, getOutbox);
router.get(   "/unread-count",           ...requireMailAccess, getUnreadCount);
router.get(   "/search",                 ...requireMailAccess, searchMessages);
router.post(  "/messages",               ...requireMailAccess, sendMessage);
router.patch( "/messages/:id/read",      ...requireMailAccess, markRead);
router.delete("/messages/:id",           ...requireMailAccess, deleteMessage);
router.post(  "/messages/:id/report",    ...requireMailAccess, reportMessage);
router.get(   "/drafts",                 ...requireMailAccess, listDrafts);
router.put(   "/drafts/:id",             ...requireMailAccess, saveDraft);
router.delete("/drafts/:id",             ...requireMailAccess, deleteDraft);
router.get(   "/trash",                  ...requireMailAccess, getTrash);
router.post(  "/trash/:id/restore",      ...requireMailAccess, restoreMessage);
router.delete("/trash/:id",              ...requireMailAccess, permanentDeleteMessage);
router.delete("/trash",                  ...requireMailAccess, emptyTrash);

// ── Moderator routes ─────────────────────────────────────────────────────────
router.get(   "/admin/reports",          ...requireModerator, adminListReports);
router.delete("/admin/messages/:id",     ...requireModerator, adminDeleteMessage);

// Internal — cross-community delivery (called by local community server, not by persons)
router.post("/messages/incoming", receiveExternalMessage);

export default router;
