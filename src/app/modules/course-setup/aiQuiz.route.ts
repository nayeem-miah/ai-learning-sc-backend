import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseSetupController } from '../course-setup/courseSetup.controller';

const router = Router();

router.post('/generate', auth(Role.ADMIN), CourseSetupController.generateQuiz);

router.post(
  '/submit',
  auth(Role.STUDENT),
  CourseSetupController.submitQuizAnswer,
);

router.get('/results', auth(), CourseSetupController.getQuizResults);

export const AIQuizRoutes = router;
