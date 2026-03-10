import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseSetupController } from './courseSetup.controller';

const router = Router();

router.post('/setup', auth('ADMIN'), CourseSetupController.courseSetup);

router.get('/all', CourseSetupController.getAllCourses);

router.get('/:id', CourseSetupController.getCourseById);

router.get('/:session_id', CourseSetupController.getCourseBySession);

router.patch('/:id', auth('ADMIN'), CourseSetupController.updateCourse);

router.patch('/lesson/:id', auth('ADMIN'), CourseSetupController.updateLesson);

router.patch('/quiz/:id', auth('ADMIN'), CourseSetupController.updateQuiz);

router.delete('/quiz/:id', auth('ADMIN'), CourseSetupController.deleteQuiz);

router.delete('/:id', auth('ADMIN'), CourseSetupController.deleteCourse);

export const CourseSetupRoutes = router;
