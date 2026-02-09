import { Router } from "express";
import auth from "../../middlewares/auth";
import { QuizController } from "./quiz.controller";

const router = Router();

// Admin/Teacher: AI generate quiz
router.post("/generate", QuizController.createQuiz);

// ✅ Student quiz list (NO correctAnswer)
router.get("/", auth(), QuizController.getQuizzesForStudent);

// ✅ Admin quiz list (includes correctAnswer) - চাইলে role-based auth করো
router.get("/admin/all", auth(), QuizController.getQuizzesForAdmin);

router.patch("/:id", auth(), QuizController.updateQuiz);
router.delete("/:id", auth(), QuizController.deleteQuiz);

// ✅ Submit
router.post("/submit", auth(), QuizController.submitQuiz);

// ✅ Result page: get attempt result
router.get("/attempts/:attemptId", auth(), QuizController.getAttemptResult);

// ✅ Attempt history
router.get("/my-attempts", auth(), QuizController.getMyAttempts);

export const quizRoutes = router;
