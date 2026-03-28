import { Router } from "express";
import { AttendanceRoutes } from "../modules/attendance/attendance.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { ClassRoutes } from "../modules/class/class.route";
import { AIQuizRoutes } from "../modules/course-setup/aiQuiz.route";
import { CourseSetupRoutes } from "../modules/course-setup/courseSetup.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import { FeedbackRoutes } from "../modules/feedback/feedback.route";
import { InviteRoutes } from "../modules/invitation/invitation.route";
import { KnowledgeFileRoutes } from "../modules/knowledgeFile/knowledgeFile.route";
import { UserRoutes } from "../modules/user/user.route";

const router = Router();

// user routes
router.use("/users", UserRoutes);
// auth routes;
router.use("/auth", AuthRoutes);
// invitation routes
router.use("/invite", InviteRoutes);

// router.use('/course', CourseRoutes);

router.use("/class", ClassRoutes);

// router.use('/quiz', quizRoutes);
router.use("/attendance", AttendanceRoutes);

// ── AI Course Setup & Quiz System
router.use("/course", CourseSetupRoutes);
router.use("/quiz", AIQuizRoutes);
router.use("/dashboard", DashboardRoutes);
router.use("/feedbacks", FeedbackRoutes);
router.use("/knowledge-files", KnowledgeFileRoutes);

export default router;
