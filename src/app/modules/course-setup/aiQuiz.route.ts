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

router.post(
  '/module/submit',
  auth(Role.STUDENT),
  CourseSetupController.submitModuleQuiz,
);

router.get('/module/result', auth(), CourseSetupController.getModuleQuizResult);

router.get(
  '/module/results/public',

  CourseSetupController.getModuleQuizResultPublic,
);

router.get('/by-ids', CourseSetupController.getQuizzesByIds);

export const AIQuizRoutes = router;
