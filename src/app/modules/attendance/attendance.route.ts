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
  auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  AttendanceController.getStudentAttendance,
);
router.get(
  '/records/:attendanceId',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.getAllAttendanceRecords,
);
router.patch(
  '/update/:attendanceId/:studentId',
  auth(Role.TEACHER, Role.ADMIN),
  AttendanceController.updateAttendanceRecord,
);

router.patch(
  '/mark-all-present/:attendanceId',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.markAllAsPresent,
);

router.patch(
  '/mark-joined-present/:attendanceId',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.markJoinedAsPresent,
);

router.get(
  '/joined-students/:attendanceId',
  auth(Role.ADMIN, Role.TEACHER),
  AttendanceController.getJoinedStudents,
);

export const AttendanceRoutes = router;
