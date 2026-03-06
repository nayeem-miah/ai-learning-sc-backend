import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';

const startClass = async (courseId: string, userId: string) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId, teacherId: userId },
  });

  if (!course) throw new ApiError(404, 'Course not found');

  const now = new Date();
  const dateOnly = new Date(now.toISOString().split('T')[0]);

  const endTime = new Date(
    now.getTime() + course.estimatedClassDuration * 60000,
  );

  return prisma.attendance.create({
    data: {
      courseId,
      date: dateOnly,
      startTime: now,
      endTime,
    },
  });
};

const joinClass = async (courseId: string, studentId: string) => {
  const now = new Date();
  const dateOnly = new Date(now.toISOString().split('T')[0]);

  const attendance = await prisma.attendance.findUnique({
    where: {
      courseId_date: {
        courseId,
        date: dateOnly,
      },
    },
  });

  if (!attendance || !attendance.isActive) throw new Error('No active class');

  const diff = (now.getTime() - attendance.startTime.getTime()) / 60000;

  let status: 'PRESENT' | 'LATE' | 'ABSENT' = 'ABSENT';

  if (diff <= 5) status = 'PRESENT';
  else if (diff <= 15) status = 'LATE';

  return prisma.attendanceRecord.upsert({
    where: {
      attendanceId_studentId: {
        attendanceId: attendance.id,
        studentId,
      },
    },
    update: {
      joinTime: now,
      status,
    },
    create: {
      attendanceId: attendance.id,
      studentId,
      joinTime: now,
      status,
    },
  });
};

const getAttendanceSummary = async (attendanceId: string) => {
  const total = await prisma.attendanceRecord.count({
    where: { attendanceId },
  });

  const present = await prisma.attendanceRecord.count({
    where: { attendanceId, status: 'PRESENT' },
  });

  const late = await prisma.attendanceRecord.count({
    where: { attendanceId, status: 'LATE' },
  });

  return {
    totalJoined: total,
    present,
    late,
    absent: total - (present + late),
  };
};

const getStudentAttendance = async (studentId: string, courseId: string) => {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendance: {
        courseId,
      },
    },
    include: {
      attendance: true,
    },
    orderBy: {
      attendance: {
        date: 'asc',
      },
    },
  });

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;

  const calendar = records.map((r) => ({
    date: r.attendance.date,
    status: r.status,
  }));

  return {
    summary: {
      present,
      late,
      absent,
    },
    calendar,
  };
};

export const AttendanceService = {
  startClass,
  joinClass,
  getAttendanceSummary,
  getStudentAttendance,
};
