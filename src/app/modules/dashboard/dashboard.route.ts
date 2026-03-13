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

export const DashboardRoutes = router;
