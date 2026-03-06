import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import { CourseController } from './course.controller';

const router = Router();

router.post('/', auth(Role.STUDENT, Role.ADMIN), CourseController.createCourse);
router.get(
  '/',
  auth(Role.ADMIN, Role.STUDENT, Role.TEACHER),
  CourseController.getAllCourses,
);
router.get(
  '/myCourses',
  auth(Role.ADMIN, Role.STUDENT, Role.TEACHER),
  CourseController.getMyCourses,
);
router.get(
  '/:id',
  auth(Role.ADMIN, Role.STUDENT),
  CourseController.getSingleCourse,
);
router.patch(
  '/:id',
  auth(Role.ADMIN, Role.STUDENT),
  CourseController.updateCourse,
);
router.delete(
  '/:id',
  auth(Role.ADMIN, Role.STUDENT),
  CourseController.deleteCourse,
);

export const CourseRoutes = router;
