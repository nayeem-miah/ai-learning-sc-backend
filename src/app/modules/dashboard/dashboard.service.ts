import { Role } from "@prisma/client";
import { prisma } from "../../prisma/prisma";

const getDashboardData = async (userId: string, role: string) => {
  let whereClause = {};
  if (role === Role.TEACHER) {
    whereClause = { teacherId: userId };
  }

  const [totalCourses, publishedCourses, draftCourses, recentCourses] = await Promise.all([
    prisma.courseNameGenerator.count({ where: whereClause }),
    prisma.courseNameGenerator.count({ where: { ...whereClause, isPublished: true } }),
    prisma.courseNameGenerator.count({ where: { ...whereClause, isPublished: false } }),
    prisma.courseNameGenerator.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { class: true },
    })
  ]);

  let totalStudents = 0;

  if (role === Role.TEACHER) {
    // Distinct students in teacher's courses
    const uniqueStudents = await prisma.enrollment.findMany({
      where: { aiCourse: { teacherId: userId } },
      distinct: ['studentId'],
      select: { studentId: true },
    });
    totalStudents = uniqueStudents.length;
  } else {
    // Admin gets all students
    totalStudents = await prisma.user.count({ where: { role: Role.STUDENT } });
  }

  return {
    totalCourses,
    publishedCourses,
    draftCourses,
    totalStudents,
    recentCourses
  };
};

const getTeacherDashboardData = async (userId: string) => {
  const whereClause = { teacherId: userId };

  const [totalCourses, publishedCourses, draftCourses, recentCourses] = await Promise.all([
    prisma.courseNameGenerator.count({ where: whereClause }),
    prisma.courseNameGenerator.count({ where: { ...whereClause, isPublished: true } }),
    prisma.courseNameGenerator.count({ where: { ...whereClause, isPublished: false } }),
    prisma.courseNameGenerator.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { class: true },
    })
  ]);

  // Distinct students in teacher's courses
  const uniqueStudents = await prisma.enrollment.findMany({
    where: { aiCourse: { teacherId: userId } },
    distinct: ['studentId'],
    select: { studentId: true },
  });
  const totalStudents = uniqueStudents.length;

  // Next classes for teacher
  const nextClasses = await prisma.courseNameGenerator.findMany({
    where: {
      teacherId: userId,
      isPublished: true, 
    },
    orderBy: {
      createdAt: "desc", // Replace with logic for upcoming date if startDate allows
    },
    take: 2, // How many "next classes" to display on dashboard
    include: {
      modules: {
        orderBy: { moduleNumber: "asc" },
        take: 1, // Next module to show
      },
    },
  });

  return {
    totalCourses,
    publishedCourses,
    draftCourses,
    totalStudents,
    recentCourses,
    nextClasses,
  };
};

const getStudentDashboardData = async (studentId: string) => {
  // 1. Fetch user & basic details
  const student = await prisma.user.findUnique({
    where: { id: studentId, role: Role.STUDENT },
    include: {
      studentProfile: true,
      studentClasses: { include: { class: true } },
      enrollments: true,
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // 2. Overall Mastery (Average of progressPercentage from enrollments)
  const enrollments = student.enrollments || [];
  const enrolledCoursesCount = enrollments.length;
  const totalProgress = enrollments.reduce(
    (sum, en) => sum + (en.progressPercentage || 0),
    0
  );
  const overallMastery =
    enrolledCoursesCount > 0
      ? Math.round(totalProgress / enrolledCoursesCount)
      : 0;

  // 3. Today's Activity
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Completed Lessons today
  const lessonsCompletedToday = await prisma.lessonProgress.count({
    where: {
      studentId: studentId,
      isCompleted: true,
      completedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  // Quizzes completed today (Answers submitted today)
  let quizzesCompletedToday = 0;
  if (student.studentProfile?.aiUserId) {
    quizzesCompletedToday = await prisma.quizAnswer.count({
      where: {
        uniqueUserId: student.studentProfile.aiUserId,
        submittedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
  }

  return {
    studentInfo: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      gradeLevel: student.studentClasses[0]?.class?.gradeLevel || "N/A",
      profilePicture: student.profilePicture,
    },
    overallMastery,
    coursesAdmitted: enrolledCoursesCount,
    todayActivity: {
      lessonsCompleted: lessonsCompletedToday,
      quizzesCompleted: quizzesCompletedToday,
    },
  };
};

const getStudentProgressData = async (studentId: string) => {
  // 1. Get enrollments with course details
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      aiCourse: true,
    },
  });

  // Calculate Overall Mastery
  const totalEnrollments = enrollments.length;
  const overallMastery =
    totalEnrollments > 0
      ? Math.round(
          enrollments.reduce((sum, en) => sum + (en.progressPercentage || 0), 0) /
            totalEnrollments,
        )
      : 0;

  // Calculate Modules Complete
  const completedLessons = await prisma.lessonProgress.count({
    where: { studentId, isCompleted: true },
  });

  const totalModules = enrollments.reduce(
    (sum, en) => sum + (en.aiCourse?.totalModules || 0),
    0,
  );

  // Time spent this week (Mock data for now, as DB has no time tracking)
  const timeSpentThisWeek = [
    { day: "Mon", hours: 4 },
    { day: "Tue", hours: 5 },
    { day: "Wed", hours: 1 },
    { day: "Thu", hours: 6 },
    { day: "Fri", hours: 5 },
    { day: "Sat", hours: 0 },
    { day: "Sun", hours: 5 },
  ];

  const totalHoursThisWeek = timeSpentThisWeek.reduce(
    (sum, d) => sum + d.hours,
    0,
  );
  const avgHoursPerDay = Math.round(totalHoursThisWeek / 7);

  // Mastery By Course
  const masteryByCourse = enrollments.map((en) => ({
    courseName:
      en.aiCourse?.generatedCourseName ||
      en.aiCourse?.courseName ||
      "Unknown Course",
    mastery: Math.round(en.progressPercentage || 0),
    masteryRequired: Math.round(en.aiCourse?.masteryRequirement || 0),
  }));

  // Recent Improvements (Mock data for presentation)
  const recentImprovements = [
    {
      courseName: "Mathematics",
      moduleName: "Module 1",
      quizName: "Quiz 2",
      improvement: 12,
      description: "Improved by 12% after 1st Re-test",
    },
    {
      courseName: "Mathematics",
      moduleName: "Module 2",
      quizName: "Quiz 1",
      improvement: 8,
      description: "Improved by 8% after 2nd Re-test",
    },
  ];

  return {
    overallMastery,
    modulesComplete: {
      completed: completedLessons,
      total: totalModules,
    },
    timeSpent: {
      totalHoursThisWeek: totalHoursThisWeek,
      averagePerDay: avgHoursPerDay,
      chartData: timeSpentThisWeek,
    },
    masteryByCourse,
    recentImprovements,
  };
};

export const DashboardService = {
  getDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getStudentProgressData,
};
