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
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // Fetch all enrolled published courses for this student
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, aiCourse: { isPublished: true } },
    include: {
      aiCourse: {
        include: {
          modules: {
            orderBy: { moduleNumber: "asc" },
            include: {
              lessonProgresses: { where: { studentId } },
              quizQuestions: true,
            },
          },
        },
      },
    },
  });

  let totalMasterySum = 0;
  let coursesWithMastery = 0;

  const pendingTasksList: any[] = [];
  const aiUserId = student.studentProfile?.aiUserId;

  const myCourses = await Promise.all(
    enrollments.map(async (en) => {
      const course = en.aiCourse;
      if (!course) return null;

      const totalModules = course.totalModules;
      const completedModulesCount = course.modules.filter(
        (m) =>
          m.lessonProgresses.length > 0 && m.lessonProgresses[0].isCompleted,
      ).length;

      const progressPercentage =
        totalModules > 0
          ? Math.round((completedModulesCount / totalModules) * 100)
          : 0;

      let mastery = 0;
      let totalScore = 0;
      let modulesWithQuizzesCount = 0;

      let courseAnswers: any[] = [];
      if (aiUserId) {
        const allQuestionIds = course.modules.flatMap((m) =>
          m.quizQuestions.map((q) => q.questionId),
        );
        if (allQuestionIds.length > 0) {
          courseAnswers = await prisma.quizAnswer.findMany({
            where: {
              uniqueUserId: aiUserId,
              uniqueSessionId: course.uniqueSessionId,
              questionId: { in: allQuestionIds },
            },
          });
        }
      }

      let coursePendingTaskAdded = false;

      for (const mod of course.modules) {
        const modQIds = mod.quizQuestions.map((q) => q.questionId);
        let quizCompleted = false;
        let quizScoreForMod = null;

        if (modQIds.length > 0 && courseAnswers.length > 0) {
          const modAnswers = courseAnswers.filter((a) =>
            modQIds.includes(a.questionId),
          );
          if (modAnswers.length > 0) {
            quizCompleted = true;
            const correct = modAnswers.filter((a) => a.isCorrect).length;
            quizScoreForMod = Math.round((correct / modQIds.length) * 100);
            totalScore += quizScoreForMod;
            modulesWithQuizzesCount++;
          }
        }

        // Logic for Pending Tasks
        if (!coursePendingTaskAdded) {
          const isLessonCompleted =
            mod.lessonProgresses.length > 0 &&
            mod.lessonProgresses[0].isCompleted;

          if (!isLessonCompleted) {
            pendingTasksList.push({
              courseId: course.id,
              courseName: course.generatedCourseName || course.courseName,
              subject: course.subject || "Subject",
              moduleId: mod.id,
              moduleTitle: mod.moduleTitle,
              moduleNumber: mod.moduleNumber,
              type: "Lesson",
              startTime: course.startTime || "9:00 AM",
              endTime: course.endTime || "10:30 AM",
            });
            coursePendingTaskAdded = true;
          } else if (modQIds.length > 0 && !quizCompleted) {
            // Lesson is completed but quiz is not
            pendingTasksList.push({
              courseId: course.id,
              courseName: course.generatedCourseName || course.courseName,
              subject: course.subject || "Subject",
              moduleId: mod.id,
              moduleTitle: mod.moduleTitle,
              moduleNumber: mod.moduleNumber,
              type: "Quiz",
              startTime: course.startTime || "9:00 AM",
              endTime: course.endTime || "10:30 AM",
            });
            coursePendingTaskAdded = true;
          }
        }
      }

      if (modulesWithQuizzesCount > 0) {
        mastery = Math.round(totalScore / modulesWithQuizzesCount);
        totalMasterySum += mastery;
        coursesWithMastery++;
      } else {
        mastery = 0;
      }

      return {
        courseId: course.id,
        courseName: course.generatedCourseName || course.courseName,
        subject: course.subject,
        progressPercentage,
        mastery,
        masteryRequired: (course as any).masteryRequirement || 0,
      };
    }),
  );

  const validCourses = myCourses.filter((c) => c !== null);
  const overallMastery =
    coursesWithMastery > 0
      ? Math.round(totalMasterySum / coursesWithMastery)
      : 0;

  // Next Class (closest pending lesson)
  let nextClass = null;
  if (pendingTasksList.length > 0) {
    nextClass = pendingTasksList[0];
  }

  return {
    studentInfo: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      gradeLevel: student.studentClasses[0]?.class?.gradeLevel || "N/A",
      profilePicture: student.profilePicture,
    },
    overallMastery,
    nextClass,
    pendingTasks: pendingTasksList.slice(0, 5), // return up to 5 pending tasks
    myCourses: validCourses,
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
