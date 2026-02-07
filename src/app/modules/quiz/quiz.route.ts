import { Router } from "express";
import { QuizController } from "./quiz.controller";

const router = Router();

router.post("/generate", QuizController.createQuiz);
router.get("/", QuizController.getQuizzes);

export const quizRoutes = router;