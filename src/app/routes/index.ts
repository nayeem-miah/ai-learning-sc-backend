import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { InviteRoutes } from "../modules/invitation/invitation.route";
import { UserRoutes } from "../modules/user/user.route";

const router = Router();

// user routes
router.use("/users", UserRoutes);
// auth routes;
router.use("/auth", AuthRoutes);
// invitation routes
router.use("/invite", InviteRoutes);

export default router;
