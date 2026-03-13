import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseSetupController } from './courseSetup.controller';

const router = Router();
// const router = express.Router();

router.post('/setup', auth(Role.ADMIN), CourseSetupController.courseSetup);

router.get('/all', CourseSetupController.getAllCourses);

router.get(
  '/student/progress-summary/:studentId?',
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  CourseSetupController.getStudentProgressSummary,
);

router.get(
  '/student/my-published-courses',
  auth(Role.STUDENT),
  CourseSetupController.getStudentPublishedCourses,
);

router.post(
  '/student/complete-lesson',
  auth(Role.STUDENT),
  CourseSetupController.completeLesson,
);

router.get(
  '/student/course-details/:id',
  auth(Role.STUDENT),
  CourseSetupController.getStudentCourseDetails,
);



//

router.get(
  '/teacher/my-published-courses',
  auth(Role.TEACHER),
  CourseSetupController.getTeacherPublishedCourses,
);

router.get('/:id', CourseSetupController.getCourseById);

router.get('/:session_id', CourseSetupController.getCourseBySession);

router.patch('/:id', auth(Role.ADMIN), CourseSetupController.updateCourse);

router.patch(
  '/lesson/:id',
  auth(Role.ADMIN),
  CourseSetupController.updateLesson,
);

router.patch('/quiz/:id', auth(Role.ADMIN), CourseSetupController.updateQuiz);

router.patch(
  '/remove-teacher/:id',
  auth(Role.ADMIN, Role.TEACHER),
  CourseSetupController.removeTeacherFromCourse,
);

router.delete('/quiz/:id', auth(Role.ADMIN), CourseSetupController.deleteQuiz);

router.delete('/:id', auth(Role.ADMIN), CourseSetupController.deleteCourse);

export const CourseSetupRoutes = router;
