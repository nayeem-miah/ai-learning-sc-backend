import { Role } from "@prisma/client";
import { Router } from "express";
import auth from "../../middlewares/auth";
import { DashboardController } from "./dashboard.controller";

const router = Router();

router.get(
  "/",
  auth(Role.ADMIN, Role.TEACHER),
  DashboardController.getDashboardData
);

export const DashboardRoutes = router;
