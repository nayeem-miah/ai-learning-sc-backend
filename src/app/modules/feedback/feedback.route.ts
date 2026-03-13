import { Router } from "express";
import { Role } from "@prisma/client";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { FeedbackController } from "./feedback.controller";
import { feedbackValidation } from "./feedback.validation";

const router = Router();

// Teacher creates feedback for a student
router.post(
  "/",
  auth(Role.TEACHER, Role.ADMIN),
  validateRequest(feedbackValidation.createFeedbackValidationSchema),
  FeedbackController.createFeedback
);

// Get my feedbacks (Student gets received feedbacks, Teacher gets feedbacks they've written)
router.get(
  "/",
  auth(Role.STUDENT, Role.TEACHER, Role.ADMIN),
  FeedbackController.getMyFeedbacks
);

// Get feedbacks for a specific student (For Teacher or Admin)
router.get(
  "/:studentId",
  auth(Role.TEACHER, Role.ADMIN),
  FeedbackController.getStudentFeedbacks
);

export const FeedbackRoutes = router;
