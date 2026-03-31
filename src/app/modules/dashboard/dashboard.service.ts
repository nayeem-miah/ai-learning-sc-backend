/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role } from '@prisma/client';
import { prisma } from '../../prisma/prisma';

const getDashboardData = async (userId: string, role: string) => {
  let whereClause = {};
  if (role === Role.TEACHER) {
    whereClause = { teacherId: userId };
  }

  const [totalCourses, publishedCourses, draftCourses, recentCourses] =
    await Promise.all([
      prisma.courseNameGenerator.count({ where: whereClause }),
      prisma.courseNameGenerator.count({
        where: { ...whereClause, isPublished: true },
      }),
      prisma.courseNameGenerator.count({
        where: { ...whereClause, isPublished: false },
      }),
      prisma.courseNameGenerator.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: true },
      }),
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
    recentCourses,
  };
};

// const getTeacherDashboardData = async (userId: string) => {
//   const whereClause = { teacherId: userId };

//   const [totalCourses, publishedCourses, draftCourses, recentCourses] =
//     await Promise.all([
//       prisma.courseNameGenerator.count({ where: whereClause }),
//       prisma.courseNameGenerator.count({
//         where: { ...whereClause, isPublished: true },
//       }),
//       prisma.courseNameGenerator.count({
//         where: { ...whereClause, isPublished: false },
//       }),
//       prisma.courseNameGenerator.findMany({
//         where: whereClause,
//         orderBy: { createdAt: 'desc' },
//         take: 5,
//         include: { class: true },
//       }),
//     ]);

//   // Distinct students in teacher's courses
//   const uniqueStudents = await prisma.enrollment.findMany({
//     where: { aiCourse: { teacherId: userId } },
//     distinct: ['studentId'],
//     select: { studentId: true },
//   });
//   const totalStudents = uniqueStudents.length;

//   // Next classes for teacher
//   const nextClasses = await prisma.courseNameGenerator.findMany({
//     where: {
//       teacherId: userId,
//       isPublished: true,
//     },
//     orderBy: {
//       createdAt: 'desc', // Replace with logic for upcoming date if startDate allows
//     },
//     take: 2, // How many "next classes" to display on dashboard
//     include: {
//       modules: {
//         orderBy: { moduleNumber: 'asc' },
//         take: 1, // Next module to show
//       },
//     },
//   });

//   return {
//     totalCourses,
//     publishedCourses,
//     draftCourses,
//     totalStudents,
//     recentCourses,
//     nextClasses,
//   };
// };

const getTeacherDashboardData = async (userId: string) => {
  const whereClause = { teacherId: userId };

  // ✅ Parallel queries
  const [totalCourses, publishedCourses, draftCourses, recentCourses] =
    await Promise.all([
      prisma.courseNameGenerator.count({ where: whereClause }),
      prisma.courseNameGenerator.count({
        where: { ...whereClause, isPublished: true },
      }),
      prisma.courseNameGenerator.count({
        where: { ...whereClause, isPublished: false },
      }),
      prisma.courseNameGenerator.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { class: true },
      }),
    ]);

  // ✅ Total unique students
  const uniqueStudents = await prisma.enrollment.findMany({
    where: { aiCourse: { teacherId: userId } },
    distinct: ['studentId'],
    select: { studentId: true },
  });
  const totalStudents = uniqueStudents.length;

  // ✅ Get all published & started courses
  const courses = await prisma.courseNameGenerator.findMany({
    where: {
      teacherId: userId,
      isPublished: true,
      startDate: {
        lte: new Date(),
      },
    },
    include: {
      modules: {
        orderBy: { moduleNumber: 'asc' },
      },
    },
  });

  const now = new Date();

  // Helper: Create a Date object for today with a specific "HH:MM AM/PM" time
  const getTimeOnDate = (date: Date, timeStr: string) => {
    const d = new Date(date);
    const [timePart, modifier] = timeStr.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  let potentialNextClasses: any[] = [];

  for (const course of courses) {
    if (!course.startTime || !course.endTime || !course.startDate) continue;

    const courseStartDay = new Date(course.startDate);
    courseStartDay.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Calculate how many days have passed since course start (excluding time)
    const daysSinceStart = Math.floor(
      (todayStart.getTime() - courseStartDay.getTime()) / (1000 * 60 * 60 * 24),
    );

    const todayEndTime = getTimeOnDate(now, course.endTime);
    const todayStartTime = getTimeOnDate(now, course.startTime);

    let targetDate = new Date(todayStart);
    let targetModuleIndex = daysSinceStart;
    let type: 'current' | 'upcoming' = 'upcoming';

    if (now < todayEndTime) {
      // Today's class is either running or hasn't started yet
      targetDate = todayStart;
      targetModuleIndex = daysSinceStart;
      if (now >= todayStartTime) {
        type = 'current';
      }
    } else {
      // Today's class is over, look for tomorrow
      targetDate.setDate(targetDate.getDate() + 1);
      targetModuleIndex = daysSinceStart + 1;
      type = 'upcoming';
    }

    // Ensure we don't exceed the number of modules
    if (targetModuleIndex >= course.modules.length) continue;

    const module = course.modules[targetModuleIndex];
    const absoluteStart = getTimeOnDate(targetDate, course.startTime);

    potentialNextClasses.push({
      courseId: course.id,
      courseName: course.generatedCourseName || course.courseName,
      subject: course.subject,
      moduleId: module?.id,
      moduleTitle: module?.moduleTitle,
      moduleNumber: module?.moduleNumber,
      startTime: course.startTime,
      endTime: course.endTime,
      absoluteStart, // Used for sorting
      type,
    });
  }

  // Find the truly next class among all courses
  let nextClass = null;
  if (potentialNextClasses.length > 0) {
    // Sort by absolute time (nearest first)
    // Priority: 'current' classes first, then by time
    potentialNextClasses.sort((a, b) => {
      if (a.type === 'current' && b.type !== 'current') return -1;
      if (a.type !== 'current' && b.type === 'current') return 1;
      return a.absoluteStart.getTime() - b.absoluteStart.getTime();
    });

    nextClass = potentialNextClasses[0];
  }

  return {
    totalCourses,
    publishedCourses,
    draftCourses,
    totalStudents,
    recentCourses,
    nextClass, // 🔥 final result
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
    throw new Error('Student not found');
  }

  // Fetch all enrolled published courses for this student
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, aiCourse: { isPublished: true } },
    include: {
      aiCourse: {
        include: {
          modules: {
            orderBy: { moduleNumber: 'asc' },
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

  const now = new Date();

  // Helper: Create a Date object for today with a specific "HH:MM AM/PM" time
  const getTimeOnDate = (date: Date, timeStr: string) => {
    const d = new Date(date);
    const [timePart, modifier] = timeStr.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  let potentialNextClasses: any[] = [];

  const myCourses = await Promise.all(
    enrollments.map(async (en) => {
      const course = en.aiCourse;
      if (!course) return null;

      // ── TIME-BASED CLASS CALCULATION (for current/next class) ──
      if (course.startTime && course.endTime && course.startDate) {
        const courseStartDay = new Date(course.startDate);
        courseStartDay.setHours(0, 0, 0, 0);

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const daysSinceStart = Math.floor(
          (todayStart.getTime() - courseStartDay.getTime()) / (1000 * 60 * 60 * 24),
        );

        const todayEndTime = getTimeOnDate(now, course.endTime);
        const todayStartTime = getTimeOnDate(now, course.startTime);

        let targetDate = new Date(todayStart);
        let targetModuleIndex = daysSinceStart;
        let type: 'current' | 'upcoming' = 'upcoming';

        if (now < todayEndTime) {
          targetDate = todayStart;
          targetModuleIndex = daysSinceStart;
          if (now >= todayStartTime) type = 'current';
        } else {
          targetDate.setDate(targetDate.getDate() + 1);
          targetModuleIndex = daysSinceStart + 1;
          type = 'upcoming';
        }

        if (targetModuleIndex >= 0 && targetModuleIndex < course.modules.length) {
          const mod = course.modules[targetModuleIndex];
          const absoluteStart = getTimeOnDate(targetDate, course.startTime);

          potentialNextClasses.push({
            courseId: course.id,
            courseName: course.generatedCourseName || course.courseName,
            subject: course.subject,
            moduleId: mod?.id,
            moduleTitle: mod?.moduleTitle,
            moduleNumber: mod?.moduleNumber,
            startTime: course.startTime,
            endTime: course.endTime,
            absoluteStart,
            type,
          });
        }
      }

      // ── PROGRESS-BASED CALCULATION (for mastery & pending tasks) ──
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

        // Logic for Pending Tasks (Study Progress)
        if (!coursePendingTaskAdded) {
          const isLessonCompleted =
            mod.lessonProgresses.length > 0 &&
            mod.lessonProgresses[0].isCompleted;

          if (!isLessonCompleted) {
            pendingTasksList.push({
              courseId: course.id,
              courseName: course.generatedCourseName || course.courseName,
              subject: course.subject || 'Subject',
              moduleId: mod.id,
              moduleTitle: mod.moduleTitle,
              moduleNumber: mod.moduleNumber,
              type: 'Lesson',
              startTime: course.startTime || '9:00 AM',
              endTime: course.endTime || '10:30 AM',
            });
            coursePendingTaskAdded = true;
          } else if (modQIds.length > 0 && !quizCompleted) {
            pendingTasksList.push({
              courseId: course.id,
              courseName: course.generatedCourseName || course.courseName,
              subject: course.subject || 'Subject',
              moduleId: mod.id,
              moduleTitle: mod.moduleTitle,
              moduleNumber: mod.moduleNumber,
              type: 'Quiz',
              startTime: course.startTime || '9:00 AM',
              endTime: course.endTime || '10:30 AM',
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

  // ── FINAL SELECTION FOR CURRENT/NEXT CLASS (Time Based) ──
  // Sort all potential classes by absolute time (nearest first)
  const sortedClasses = potentialNextClasses.sort(
    (a, b) => a.absoluteStart.getTime() - b.absoluteStart.getTime(),
  );

  const nextClass = sortedClasses.length > 0 ? sortedClasses[0] : null;

  return {
    studentInfo: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      gradeLevel: student.studentClasses[0]?.class?.gradeLevel || 'N/A',
      profilePicture: student.profilePicture,
    },
    overallMastery,
    nextClass,    // 🔥 Prioritized current or next class 
    pendingTasks: pendingTasksList.slice(0, 5), // Keep study progress
    myCourses: validCourses,
  };
};

const getStudentProgressData = async (studentId: string) => {
  // 1. Get enrollments with course details
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      aiCourse: {
        include: {
          modules: {
            include: {
              quizQuestions: true,
            },
          },
        },
      },
    },
  });

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: true },
  });
  const aiUserId = student?.studentProfile?.aiUserId;

  // Calculate Overall Mastery
  const totalEnrollments = enrollments.length;

  // We should calculate mastery from actual quiz answers, not just progressPercentage
  let totalMasterySum = 0;
  let enrollmentsWithMastery = 0;

  const masteryByCourse = await Promise.all(
    enrollments.map(async (en) => {
      const course = en.aiCourse;
      if (!course || !aiUserId)
        return {
          courseName:
            en.aiCourse?.generatedCourseName ||
            en.aiCourse?.courseName ||
            'Unknown Course',
          mastery: 0,
          masteryRequired: Math.round(en.aiCourse?.masteryRequirement || 0),
        };

      const questionIds = course.modules.flatMap((m) =>
        m.quizQuestions.map((q) => q.questionId),
      );
      let courseMastery = 0;

      if (questionIds.length > 0) {
        const answers = await prisma.quizAnswer.findMany({
          where: {
            uniqueUserId: aiUserId,
            uniqueSessionId: course.uniqueSessionId,
            questionId: { in: questionIds },
          },
        });

        if (answers.length > 0) {
          // Group by questionId and take latest answer for each question
          const latestAnswers = new Map();
          answers.forEach((a) => {
            const existing = latestAnswers.get(a.questionId);
            if (!existing || a.submittedAt > existing.submittedAt) {
              latestAnswers.set(a.questionId, a);
            }
          });

          const correct = Array.from(latestAnswers.values()).filter(
            (a) => a.isCorrect,
          ).length;
          courseMastery = Math.round((correct / latestAnswers.size) * 100);
          totalMasterySum += courseMastery;
          enrollmentsWithMastery++;
        }
      }

      return {
        courseName:
          course.generatedCourseName || course.courseName || 'Unknown Course',
        mastery: courseMastery,
        masteryRequired: Math.round(course.masteryRequirement || 0),
      };
    }),
  );

  const overallMastery =
    enrollmentsWithMastery > 0
      ? Math.round(totalMasterySum / enrollmentsWithMastery)
      : 0;

  // Calculate Modules Complete
  const completedLessonsCount = await prisma.lessonProgress.count({
    where: { studentId, isCompleted: true },
  });

  const totalModules = enrollments.reduce(
    (sum, en) => sum + (en.aiCourse?.totalModules || 0),
    0,
  );

  // Time spent this week (Dynamic data from AttendanceRecord)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendance: {
        date: { gte: weekAgo },
      },
      status: { in: ['PRESENT', 'LATE'] },
    },
    include: {
      attendance: true,
    },
  });

  const timeSpentMap: Record<string, number> = {};
  days.forEach((d) => (timeSpentMap[d] = 0));

  attendanceRecords.forEach((rec) => {
    const dayName = days[rec.attendance.date.getDay()];
    // Calculate duration in hours
    const start = rec.joinTime || rec.attendance.startTime;
    const end = rec.attendance.endTime;
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 0) {
      timeSpentMap[dayName] += durationHours;
    }
  });

  const timeSpentThisWeek = days.map((day) => ({
    day,
    hours: Math.round(timeSpentMap[day] * 10) / 10, // Round to 1 decimal
  }));

  // Re-sort to show today as the last day if desired, but
  // typical charts show Mon-Sun. Let's stick to days order starting from Mon
  const monFirstOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sortedTimeSpent = monFirstOrder.map(
    (day) => timeSpentThisWeek.find((d) => d.day === day)!,
  );

  const totalHoursThisWeek =
    Math.round(sortedTimeSpent.reduce((sum, d) => sum + d.hours, 0) * 10) / 10;
  const avgHoursPerDay = Math.round((totalHoursThisWeek / 7) * 10) / 10;

  // Recent Improvements (Dynamic logic)
  // We'll look for modules where the student has multiple attempts and the score improved
  const recentImprovements: any[] = [];

  if (aiUserId) {
    for (const en of enrollments) {
      if (!en.aiCourse) continue;
      for (const mod of en.aiCourse.modules) {
        const qIds = mod.quizQuestions.map((q) => q.questionId);
        if (qIds.length === 0) continue;

        const answers = await prisma.quizAnswer.findMany({
          where: {
            uniqueUserId: aiUserId,
            questionId: { in: qIds },
          },
          orderBy: { submittedAt: 'asc' },
        });

        if (answers.length > qIds.length) {
          // This suggests multiple attempts (more answers than questions)
          // Simplified: compare first set with latest set
          const firstSet = answers.slice(0, qIds.length);
          const latestSet = answers.slice(-qIds.length);

          const firstScore = Math.round(
            (firstSet.filter((a) => a.isCorrect).length / qIds.length) * 100,
          );
          const latestScore = Math.round(
            (latestSet.filter((a) => a.isCorrect).length / qIds.length) * 100,
          );

          if (latestScore > firstScore) {
            recentImprovements.push({
              courseName: en.aiCourse.courseName,
              moduleName: mod.moduleTitle,
              quizName: `Module ${mod.moduleNumber} Quiz`,
              improvement: latestScore - firstScore,
              description: `Improved by ${latestScore - firstScore}% after re-test`,
            });
          }
        }
      }
    }
  }

  // If no improvements found, we can show recent completed quizzes with high scores as "Performance"
  if (recentImprovements.length === 0) {
    // Fallback to top scores or just empty
  }

  return {
    overallMastery,
    modulesComplete: {
      completed: completedLessonsCount,
      total: totalModules,
    },
    timeSpent: {
      totalHoursThisWeek: totalHoursThisWeek,
      averagePerDay: avgHoursPerDay,
      chartData: sortedTimeSpent,
    },
    masteryByCourse,
    recentImprovements: recentImprovements.slice(0, 3), // Show top 3 improvements
  };
};

export const DashboardService = {
  getDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getStudentProgressData,
};
