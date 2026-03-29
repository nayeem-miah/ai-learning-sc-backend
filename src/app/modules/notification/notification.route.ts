import { Router } from "express";
import { Role } from "@prisma/client";
import auth from "../../middlewares/auth";
import { NotificationController } from "./notification.controller";

const router = Router();

router.get(
  "/",
  auth(Role.STUDENT, Role.TEACHER, Role.ADMIN),
  NotificationController.getMyNotifications,
);

router.patch(
  "/mark-read/:id",
  auth(Role.STUDENT, Role.TEACHER, Role.ADMIN),
  NotificationController.markAsRead,
);

router.patch(
  "/mark-all-read",
  auth(Role.STUDENT, Role.TEACHER, Role.ADMIN),
  NotificationController.markAllAsRead,
);

export const NotificationRoutes = router;
