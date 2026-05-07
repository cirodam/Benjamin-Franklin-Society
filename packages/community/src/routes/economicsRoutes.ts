import { Router } from "express";
import { requireAuth, requireAdmin } from "./middleware.js";
import * as economics from "./EconomicsController.js";
import * as federation from "./FederationController.js";
import * as budget from "./BudgetController.js";
import * as paymentTokens from "./PaymentTokenController.js";
import * as transfers from "./TransferController.js";
import * as mailRelay from "./MailRelayController.js";

const router = Router();

// Economics (public transparency)
router.get( "/economics",            economics.getEconomics);
router.get( "/budget",               budget.getCommunityBudget);
router.post("/budget/simulate-step", requireAdmin, budget.simulateStep);

// Federation membership
router.get( "/federation",          federation.getFederationStatus);
router.post("/federation/apply",    federation.applyToFederation);
router.get( "/federation/sync",     federation.syncFederationStatus);
router.post("/federation/register", federation.registerAsFounded);

// Payment tokens — steward-only management; receive is federation-signed
router.post(  "/payment-tokens",                  requireAdmin, paymentTokens.issueToken);
router.post(  "/payment-tokens/:token/rotate",    requireAdmin, paymentTokens.rotateToken);
router.delete("/payment-tokens/:token",           requireAdmin, paymentTokens.revokeToken);
router.get(   "/payment-tokens/person/:personId", requireAdmin, paymentTokens.listTokensForPerson);
router.post(  "/payment-tokens/receive",                          paymentTokens.receivePayment);

// Cross-community transfers
router.post("/transfers/out",  requireAuth, transfers.sendTransfer);
router.post("/transfers/send", requireAuth, transfers.sendTransferByHandle);

// Cross-community mail relay (internal — called by local mail service)
router.post("/mail/route-external", mailRelay.routeExternalMail);

export default router;
