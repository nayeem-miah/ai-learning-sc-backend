import { Router } from "express";
import { InviteController } from "./invitation.controller";

const router = Router();

// Existing routes
router.get("/verify", InviteController.verifyInvite);
router.post("/send", InviteController.sendInvite);

router.post("/accept", InviteController.acceptInvite);

export const InviteRoutes = router;
