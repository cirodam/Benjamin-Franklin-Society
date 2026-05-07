import { Router, type Request, type Response, type NextFunction } from "express";
import { verifyNodeSignature } from "@ecf/core";
import { getCommunityIdentity } from "../communityIdentity.js";
import { requireAuth, requireTeller, requireBankAdmin, requireBankAccess } from "./middleware.js";
import { createAccount, getAllAccounts, getAccounts, getAccountById, getTransactions, createTransfer, applyDemurrage, getMyAccounts, createMyAccount, deleteMyAccount, renameMyAccount, closeOwnerAccounts, adminGetAccounts, adminReverseTransaction, listPersons, sendTransferByHandle, getMyAccountByHandle, getMyAccountTransactions, deleteMyAccountByHandle, renameMyAccountByHandle } from "./BankController.js";

const router = Router();

// Middleware that verifies an x-node-signature from the owning community node.
const requireNodeAuth = verifyNodeSignature(() => getCommunityIdentity().publicKey);

// Accepts either a valid PersonCredential (person-initiated) or a community
// node signature (institutional caller). Tries node auth first; if the header
// is absent, falls through to PersonCredential verification.
function requireAuthOrNodeSignature(req: Request, res: Response, next: NextFunction): void {
    if (req.headers["x-node-signature"]) {
        requireNodeAuth(req, res, next);
    } else {
        requireAuth(req, res, next);
    }
}

// Admin / infrastructure routes — node signature required
router.get(   "/accounts",                         requireNodeAuth, getAllAccounts);
router.post(  "/accounts",                         requireNodeAuth, createAccount);
router.delete("/accounts/:ownerId/all",            requireNodeAuth, closeOwnerAccounts);
router.get(   "/account/:accountId",               requireAuthOrNodeSignature, getAccountById);
router.post("/demurrage",                        requireAuthOrNodeSignature, applyDemurrage);

// Member routes — require a valid community-issued credential
router.get(   "/me/accounts",                             ...requireBankAccess, getMyAccounts);
router.post(  "/me/accounts",                             ...requireBankAccess, createMyAccount);
router.delete("/me/accounts/:accountId",                  ...requireBankAccess, deleteMyAccount);
router.patch( "/me/accounts/:accountId",                  ...requireBankAccess, renameMyAccount);
// Handle-based member routes (preferred — no UUID exposure)
router.get(   "/me/accounts/by-handle/:handle",           ...requireBankAccess, getMyAccountByHandle);
router.get(   "/me/accounts/by-handle/:handle/transactions", ...requireBankAccess, getMyAccountTransactions);
router.delete("/me/accounts/by-handle/:handle",           ...requireBankAccess, deleteMyAccountByHandle);
router.patch( "/me/accounts/by-handle/:handle",           ...requireBankAccess, renameMyAccountByHandle);
router.get(   "/accounts/:ownerId",                       requireAuthOrNodeSignature, getAccounts);
router.get(   "/accounts/:accountId/transactions",        requireAuthOrNodeSignature, getTransactions);
router.post(  "/transfers",                               requireAuthOrNodeSignature, createTransfer);
router.post(  "/transfers/send",                          ...requireBankAccess, sendTransferByHandle);
router.get(   "/persons",                                 ...requireBankAccess, listPersons);

// Teller routes — require bank: teller permission
router.get(  "/admin/accounts",                    ...requireTeller, adminGetAccounts);

// Bank admin routes — require bank: admin permission
router.post( "/admin/transactions/:id/reverse",    ...requireBankAdmin, adminReverseTransaction);

export default router;
