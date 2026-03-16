import { Router } from "express";
import { InviteController } from "./invitation.controller";

const router = Router();

// Existing routes
router.post("/send", InviteController.sendInvite);
router.get("/verify", InviteController.verifyInvite);
router.post("/accept", InviteController.acceptInvite);

export const InviteRoutes = router;
