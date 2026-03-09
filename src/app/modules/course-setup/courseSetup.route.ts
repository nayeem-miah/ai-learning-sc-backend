import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseSetupController } from './courseSetup.controller';

const router = Router();

// POST /api/v1/course/setup — ADMIN only
router.post('/setup', auth('ADMIN'), CourseSetupController.courseSetup);

// GET /api/v1/course/all
// → Returns all courses with nested modules (lectures) + quizzes
router.get('/all', CourseSetupController.getAllCourses);

// GET /api/v1/course/:session_id
// → Returns single course by session ID with nested modules + quizzes
router.get('/:session_id', CourseSetupController.getCourseBySession);

export const CourseSetupRoutes = router;
