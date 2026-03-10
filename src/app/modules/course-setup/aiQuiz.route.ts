import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseSetupController } from '../course-setup/courseSetup.controller';

const router = Router();

// ─── Existing single-answer quiz routes ───────────────────────────────────────
router.post('/generate', auth(Role.ADMIN), CourseSetupController.generateQuiz);

router.post(
  '/submit',
  auth(Role.STUDENT),
  CourseSetupController.submitQuizAnswer,
);

router.get('/results', auth(), CourseSetupController.getQuizResults);

// ─── Module Quiz: bulk submit all answers for one module at once ──────────────
// POST /api/ai-quiz/module/submit
// Body: { unique_user_id, unique_session_id, module_id, answers: [{question_id, selected_answer}] }
router.post(
  '/module/submit',
  auth(Role.STUDENT),
  CourseSetupController.submitModuleQuiz,
);

// GET /api/ai-quiz/module/result?unique_user_id=&unique_session_id=&module_id=
// Authenticated user sees their own module quiz result
router.get(
  '/module/result',
  auth(),
  CourseSetupController.getModuleQuizResult,
);

// GET /api/ai-quiz/module/results/public?unique_session_id=&module_id=
// Public — no auth required, everyone can see all users' results
router.get(
  '/module/results/public',
  CourseSetupController.getModuleQuizResultPublic,
);

export const AIQuizRoutes = router;

