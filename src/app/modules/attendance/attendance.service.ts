/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";

const startClass = async (
  courseId: string,
  moduleId: string,
  userId: string,
) => {
  const aiCourse = await prisma.courseNameGenerator.findUnique({
    where: { id: courseId, teacherId: userId },
  });

  if (!aiCourse)
    throw new ApiError(
      404,
      "Course not found or you are not the assigned teacher",
    );

  const module = await prisma.courseLectureGenerator.findFirst({
    where: { id: moduleId, uniqueSessionId: aiCourse.uniqueSessionId },
  });

  if (!module) throw new ApiError(404, "Module not found for this course");

  const now = new Date();
  const dateOnly = new Date(now.toISOString().split("T")[0]);

  let startTime = now;
  if (aiCourse.startTime) {
    // Attempt to parse "09:00 AM" into today's Date
    try {
      const [time, modifier] = aiCourse.startTime.split(" ");
      // eslint-disable-next-line prefer-const
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;

      startTime = new Date(dateOnly);
      startTime.setHours(hours, minutes, 0, 0);
    } catch (e: any) {
      startTime = now; // fallback to current time
    }
  }

  const existingAttendance = await prisma.attendance.findUnique({
    where: {
      courseId_moduleId_date: {
        courseId,
        moduleId,
        date: dateOnly,
      },
    },
  });

  if (existingAttendance)
    throw new ApiError(400, "Class already started for this lesson today");

  // End time is either parsed from aiCourse or calculated from duration
  let endTime = new Date(
    startTime.getTime() + aiCourse.estimatedDurationMinPerClass * 60000,
  );
  if (aiCourse.endTime) {
    try {
      const [time, modifier] = aiCourse.endTime.split(" ");
      // eslint-disable-next-line prefer-const
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;

      endTime = new Date(dateOnly);
      endTime.setHours(hours, minutes, 0, 0);
    } catch (e) {
      // fallback
    }
  }

  return await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.create({
      data: {
        aiCourseId: courseId,
        courseId,
        moduleId,
        date: dateOnly,
        startTime: startTime,
        endTime,
      },
    });

    const enrollments = await tx.enrollment.findMany({
      where: { aiCourseId: courseId },
      select: { studentId: true },
    });

    if (enrollments.length > 0) {
      await tx.attendanceRecord.createMany({
        data: enrollments.map((enrollment) => ({
          attendanceId: attendance.id,
          studentId: enrollment.studentId,
          status: "ABSENT",
        })),
      });
    }

    return attendance;
  });
};

const joinClass = async (
  courseId: string,
  moduleId: string,
  studentId: string,
) => {
  const now = new Date();
  const dateOnly = new Date(now.toISOString().split("T")[0]);

  const attendance = await prisma.attendance.findUnique({
    where: {
      courseId_moduleId_date: {
        courseId,
        moduleId,
        date: dateOnly,
      },
    },
  });

  if (!attendance || !attendance.isActive)
    throw new ApiError(
      404,
      "No active class session found for this lesson today",
    );

  // Check if student is even enrolled (though attendance record should exist if they were enrolled at start)
  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      attendanceId_studentId: {
        attendanceId: attendance.id,
        studentId,
      },
    },
  });

  if (!existingRecord) {
    // Maybe they enrolled after class started?
    throw new ApiError(
      403,
      "You are not enrolled in this class or record not found",
    );
  }

  // If already marked as PRESENT or LATE, don't update time
  if (existingRecord.status === "PRESENT" || existingRecord.status === "LATE") {
    return existingRecord;
  }

  const diff = (now.getTime() - attendance.startTime.getTime()) / 60000;

  let status: "PRESENT" | "LATE" | "ABSENT" = "ABSENT";

  if (diff <= 5) status = "PRESENT";
  else if (diff <= 15) status = "LATE";
  else status = "LATE";

  return prisma.attendanceRecord.update({
    where: {
      id: existingRecord.id,
    },
    data: {
      joinTime: now,
      status,
    },
  });
};

const updateAttendanceRecord = async (
  attendanceId: string,
  studentId: string,
  status: "PRESENT" | "LATE" | "ABSENT",
) => {
  return prisma.attendanceRecord.update({
    where: {
      attendanceId_studentId: {
        attendanceId,
        studentId,
      },
    },
    data: {
      status,
    },
  });
};

const getAttendanceSummary = async (attendanceId: string) => {
  const total = await prisma.attendanceRecord.count({
    where: { attendanceId },
  });

  const present = await prisma.attendanceRecord.count({
    where: { attendanceId, status: "PRESENT" },
  });

  const late = await prisma.attendanceRecord.count({
    where: { attendanceId, status: "LATE" },
  });

  return {
    totalJoined: total,
    present,
    late,
    absent: total - (present + late),
  };
};

const getStudentAttendance = async (
  studentId: string,
  courseId?: string,
  month?: number,
  year?: number,
) => {
  const where: any = {
    studentId,
  };

  const attendanceFilter: any = {};
  if (courseId && courseId !== "all") {
    attendanceFilter.courseId = courseId;
  }

  if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    attendanceFilter.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  if (Object.keys(attendanceFilter).length > 0) {
    where.attendance = attendanceFilter;
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      attendance: {
        include: {
          aiCourse: {
            select: {
              courseName: true,
              generatedCourseName: true,
            },
          },
        },
      },
    },
    orderBy: {
      attendance: {
        date: "asc",
      },
    },
  });

  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const total = records.length;

  const attendanceRate =
    total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const calendar = records.map((r) => ({
    date: r.attendance.date,
    status: r.status,
    courseName:
      r.attendance.aiCourse?.courseName ||
      r.attendance.aiCourse?.generatedCourseName ||
      "Unknown Course",
  }));

  return {
    summary: {
      present,
      late,
      absent,
      total,
      attendanceRate,
    },
    calendar,
  };
};

const getAllAttendanceRecords = async (attendanceId: string) => {
  return prisma.attendanceRecord.findMany({
    where: {
      attendanceId,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      student: {
        firstName: "asc",
      },
    },
  });
};

const getJoinedStudents = async (attendanceId: string) => {
  return prisma.attendanceRecord.findMany({
    where: {
      attendanceId,
      joinTime: {
        not: null,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      joinTime: "desc",
    },
  });
};

const markJoinedAsPresent = async (attendanceId: string) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) throw new ApiError(404, "Attendance session not found");

  const joinedRecords = await prisma.attendanceRecord.findMany({
    where: {
      attendanceId,
      joinTime: {
        not: null,
      },
    },
  });

  if (joinedRecords.length === 0)
    return { message: "No students have joined yet" };

  const updates = joinedRecords.map((record) => {
    const diff =
      (record.joinTime!.getTime() - attendance.startTime.getTime()) / 60000;

    let status: "PRESENT" | "LATE" = "PRESENT";
    if (diff > 5) {
      status = "LATE";
    }

    return prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { status },
    });
  });

  await Promise.all(updates);
  return {
    message: "Joined students marked correctly based on their join time",
  };
};

const markAllAsPresent = async (attendanceId: string) => {
  return prisma.attendanceRecord.updateMany({
    where: {
      attendanceId,
    },
    data: {
      status: "PRESENT",
    },
  });
};

export const AttendanceService = {
  startClass,
  joinClass,
  updateAttendanceRecord,
  markAllAsPresent,
  markJoinedAsPresent,
  getJoinedStudents,
  getAttendanceSummary,
  getStudentAttendance,
  getAllAttendanceRecords,
};
