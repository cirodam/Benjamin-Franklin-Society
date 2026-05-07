import { Router } from "express";
import { requireAuth, requireAdmin } from "./middleware.js";
import * as persons from "./PersonController.js";
import * as auth from "./AuthController.js";

const router = Router();

router.get(   "/persons",                              requireAuth,    persons.listPersons);
router.get(   "/persons/:handle",                      requireAuth,    persons.getPerson);
router.post(  "/persons",                              ...requireAdmin, persons.addPerson);
router.patch( "/persons/:handle",                      ...requireAdmin, persons.updatePerson);
router.delete("/persons/:handle",                      ...requireAdmin, persons.dischargePerson);
router.post(  "/persons/:handle/credential",           ...requireAdmin, persons.issueCredential);
router.post(  "/persons/:handle/password",             ...requireAdmin, auth.setPassword);
router.post(  "/persons/:handle/pin",                  ...requireAdmin, auth.setPin);
router.post(  "/persons/:handle/admin",               ...requireAdmin, persons.grantAdmin);
router.delete("/persons/:handle/admin",               ...requireAdmin, persons.revokeAdmin);
router.post(  "/persons/:handle/apps/:app",            ...requireAdmin, persons.grantApp);
router.delete("/persons/:handle/apps/:app",            ...requireAdmin, persons.revokeApp);


router.post("/auth/login",           auth.login);
router.post("/auth/verify",          auth.verifyCredential);
router.post("/auth/change-password", requireAuth, auth.changeOwnPassword);

export default router;
