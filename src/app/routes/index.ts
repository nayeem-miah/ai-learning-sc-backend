import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { InviteRoutes } from "../modules/invitation/invitation.route";
import { UserRoutes } from "../modules/user/user.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/auth", AuthRoutes);
router.use("/invite", InviteRoutes);

export default router;
