import { Role } from "@prisma/client";
import { Router } from "express";
import auth from "../../middlewares/auth";
import { DashboardController } from "./dashboard.controller";

const router = Router();

router.get(
  "/",
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  DashboardController.getDashboardData,
);

router.get(
  "/teacher/summery",
  auth(Role.TEACHER),
  DashboardController.getTeacherDashboardData,
);

// get a specific student's dashboard (for teacher, admin, or parent who has access)
router.get(
  "/student/summery/:id",
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  DashboardController.getStudentDashboardData,
);

// get own student dashboard (for student)
router.get(
  "/student/summery",
  auth(Role.STUDENT),
  DashboardController.getStudentDashboardData,
);

// get a specific student's progress (for teacher, admin, or parent who has access)
router.get(
  "/student/progress/:id",
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  DashboardController.getStudentProgressData,
);

// get own student progress (for student)
router.get(
  "/student/progress",
  auth(Role.STUDENT),
  DashboardController.getStudentProgressData,
);

export const DashboardRoutes = router;
