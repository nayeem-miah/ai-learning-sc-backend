import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { ClassRoutes } from "../modules/class/class.route";
import { CourseRoutes } from "../modules/course/course.route";
import { InviteRoutes } from "../modules/invitation/invitation.route";
import { UserRoutes } from "../modules/user/user.route";

const router = Router();

// user routes
router.use("/users", UserRoutes);
// auth routes;
router.use("/auth", AuthRoutes);
// invitation routes
router.use("/invite", InviteRoutes);

router.use("/course", CourseRoutes);

router.use("/class", ClassRoutes);

export default router;
