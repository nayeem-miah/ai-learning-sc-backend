import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import { AttendanceController } from './attendance.controller';

const router = Router();

router.post(
  '/start',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.startClass,
);
router.post(
  '/join',
  auth(Role.STUDENT, Role.TEACHER),
  AttendanceController.joinClass,
);
router.get(
  '/summary/:attendanceId',
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  AttendanceController.getAttendanceSummary,
);
router.get(
  '/student/:courseId',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.getStudentAttendance,
);

export const AttendanceRoutes = router;
