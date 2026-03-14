/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';

const registerStudent = async (payload: any) => {
  const { firstName, lastName, email, password, gradeLevel } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(409, 'User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // 🔐 TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    // 1. Verify Class exists
    const targetClass = await tx.class.findUnique({
      where: { id: gradeLevel },
    });

    if (!targetClass) {
      throw new ApiError(404, 'Class not found');
    }

    const user = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: Role.STUDENT,
        status: Status.ACTIVE,
        profilePicture:
          'https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg',
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        gradeLevel: targetClass.gradeLevel, // Use actual grade name
      },
    });

    // 2. Link Student to Class
    await tx.studentClass.create({
      data: {
        studentId: user.id,
        classId: targetClass.id,
      },
    });

    // 3. Update total students count in Class
    await tx.class.update({
      where: { id: targetClass.id },
      data: {
        totalStudents: { increment: 1 },
      },
    });

    // ── AUTO-ENROLLMENT ──
    // Find all courses that match the student's grade level
    const matchingCourses = await tx.courseNameGenerator.findMany({
      where: {
        targetGradeLevel: targetClass.gradeLevel,
      },
    });

    if (matchingCourses.length > 0) {
      const enrollmentData = matchingCourses.map((course) => ({
        studentId: user.id,
        aiCourseId: course.id,
        courseId: null,
      }));

      await tx.enrollment.createMany({
        data: enrollmentData as any,
      });
    }

    return user;
  });

  return result;
};

const getAllStudents = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereCondition = {
    role: Role.STUDENT,
  };

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where: whereCondition,
      include: {
        studentProfile: true,
        studentClasses: {
          include: {
            class: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({
      where: whereCondition,
    }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: students,
  };
};

const getAllTeachers = async () => {
  const teachers = await prisma.user.findMany({
    where: {
      role: Role.TEACHER,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!teachers) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Teachers not found');
  }

  return teachers;
};

const getMyProfile = async (userId: string) => {
  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    include: {
      studentProfile: true,
      studentClasses: {
        include: {
          class: true,
        },
      },
    },
  });
  return result;
};

const getStudentById = async (id: string) => {
  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      role: 'STUDENT',
    },
    include: {
      studentProfile: true,
      studentClasses: {
        include: {
          class: true,
        },
      },
    },
  });
  return result;
};

const updateProfile = async (userId: string, payload: any) => {
  const { firstName, lastName, currentPassword, newPassword, profilePicture } =
    payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const updateData: any = {};

  // name update
  if (firstName) {
    updateData.firstName = firstName;
  }
  if (lastName) {
    updateData.lastName = lastName;
  }

  // profile photo
  if (profilePicture) {
    updateData.profilePicture = profilePicture;
  }

  // password change
  if (currentPassword && newPassword) {
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      role: true,
      profilePicture: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const toggleUserRole = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // 🔁 toggle logic
  let newRole: Role;

  if (user.role === Role.ADMIN) {
    newRole = Role.STUDENT;
  } else {
    newRole = Role.ADMIN;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      role: newRole,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePicture: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

const deleteUser = async (id: string) => {
  const result = await prisma.$transaction(async (tx) => {
    // Delete student profile if exists
    await tx.studentProfile.deleteMany({
      where: { userId: id },
    });

    // Delete teacher profile if exists
    await tx.teacherProfile.deleteMany({
      where: { userId: id },
    });

    return await tx.user.delete({
      where: { id },
    });
  });
  return result;
};

const deleteMe = async (userId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.studentProfile.delete({
      where: { userId },
    });
    return await tx.user.delete({
      where: { id: userId },
    });
  });
  return result;
};

const createUserLink = async (
  loggedInUserId: string,
  email: string,
  password: string,
) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { email },
  });

  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await bcrypt.compare(password, targetUser.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid password');
  }

  const targetUserId = targetUser.id;

  if (loggedInUserId === targetUserId) {
    throw new Error('You cannot link yourself');
  }

  // check already linked
  const existing = await prisma.userLink.findUnique({
    where: {
      fromId_toId: {
        fromId: loggedInUserId,
        toId: targetUserId,
      },
    },
  });

  if (existing) {
    throw new ApiError(401, 'Already linked');
  }

  // create mutual link in transaction
  return await prisma.$transaction(async (tx) => {
    const userLink = await tx.userLink.create({
      data: {
        fromId: loggedInUserId,
        toId: targetUserId,
      },
    });

    await tx.userLink.create({
      data: {
        fromId: targetUserId,
        toId: loggedInUserId,
      },
    });

    return userLink;
  });
};

const removeUserLink = async (loggedInUserId: string, targetUserId: string) => {
  await prisma.userLink.deleteMany({
    where: {
      OR: [
        { fromId: loggedInUserId, toId: targetUserId },
        { fromId: targetUserId, toId: loggedInUserId },
      ],
    },
  });

  return { message: 'User unlinked successfully' };
};

const getLinkedUsers = async (loggedInUserId: string) => {
  const loggedInUserRaw = await prisma.user.findUnique({
    where: { id: loggedInUserId },
    include: {
      studentProfile: true,
      studentClasses: {
        include: {
          class: true,
        },
      },
      enrollments: true,
    },
  });

  let loggedInUser = null;
  if (loggedInUserRaw) {
    const rawUser = loggedInUserRaw as any;
    const enrollments = rawUser.enrollments || [];
    const totalProgress = enrollments.reduce(
      (sum: number, en: any) => sum + (en.progressPercentage || 0),
      0,
    );
    const overallMastery =
      enrollments.length > 0
        ? Math.round(totalProgress / enrollments.length)
        : 0;

    const { enrollments: _, ...userWithoutEnrollments } = rawUser;
    loggedInUser = { ...userWithoutEnrollments, overallMastery };
  }

  // Query only fromId to avoid duplicates in mutual links
  const links = await prisma.userLink.findMany({
    where: { fromId: loggedInUserId },
    include: {
      to: {
        include: {
          studentProfile: true,
          studentClasses: {
            include: {
              class: true,
            },
          },
          enrollments: true,
        },
      },
    },
  });

  const linkedUsers = links.map((link) => {
    const user = link.to as any;
    const enrollments = user.enrollments || [];

    // Calculate average progress as overallMastery
    const totalProgress = enrollments.reduce(
      (sum: number, en: any) => sum + (en.progressPercentage || 0),
      0,
    );
    const overallMastery =
      enrollments.length > 0
        ? Math.round(totalProgress / enrollments.length)
        : 0;

    // Remove enrollments from the final object to keep it clean
    const { enrollments: _, ...userWithoutEnrollments } = user;

    return {
      ...userWithoutEnrollments,
      overallMastery,
    };
  });

  return {
    loggedInUser,
    linkedUsers,
  };
};

const getStudentManagementData = async (
  loggedInUserId: string,
  role: Role,
  query: {
    searchTerm?: string;
    classId?: string;
    courseId?: string;
    page?: string;
    limit?: string;
  },
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // 1. Build the filter for students
  const whereCondition: any = {
    role: Role.STUDENT,
  };

  if (query.searchTerm) {
    whereCondition.OR = [
      { firstName: { contains: query.searchTerm, mode: 'insensitive' } },
      { lastName: { contains: query.searchTerm, mode: 'insensitive' } },
      { email: { contains: query.searchTerm, mode: 'insensitive' } },
    ];
  }

  // Teacher can only see students in their courses
  if (role === Role.TEACHER) {
    whereCondition.enrollments = {
      some: {
        aiCourse: {
          teacherId: loggedInUserId,
        },
      },
    };
  }

  // Filter by Course
  if (query.courseId) {
    whereCondition.enrollments = {
      some: {
        aiCourseId: query.courseId,
      },
    };
  }

  // Filter by Class
  if (query.classId) {
    whereCondition.studentClasses = {
      some: {
        classId: query.classId,
      },
    };
  }

  // 2. Fetch Students with necessary relations
  const [students, totalStudents] = await Promise.all([
    prisma.user.findMany({
      where: whereCondition,
      include: {
        studentProfile: true,
        studentClasses: {
          include: {
            class: true,
          },
        },
        enrollments: {
          select: {
            progressPercentage: true,
            aiCourseId: true,
          },
        },
        attendanceRecords: {
          select: {
            status: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where: whereCondition }),
  ]);

  // 3. Calculate Summary Stats for the ENTIRE filtered set (not just current page)
  // To be accurate, we need to fetch all filtered student IDs for the header stats
  const allFilteredStudents = await prisma.user.findMany({
    where: whereCondition,
    select: {
      id: true,
      enrollments: {
        select: {
          progressPercentage: true,
        },
      },
      attendanceRecords: {
        select: {
          status: true,
        },
      },
    },
  });

  let engagedCount = 0;
  let noActivityCount = 0;
  let totalPresentLate = 0;
  let totalAttendanceRecords = 0;

  allFilteredStudents.forEach((student) => {
    const hasActivity = student.enrollments.some((e) => e.progressPercentage > 0);
    if (hasActivity) {
      engagedCount++;
    } else {
      noActivityCount++;
    }

    student.attendanceRecords.forEach((ar) => {
      totalAttendanceRecords++;
      if (ar.status === 'PRESENT' || ar.status === 'LATE') {
        totalPresentLate++;
      }
    });
  });

  const overallAttendanceRate =
    totalAttendanceRecords > 0
      ? Math.round((totalPresentLate / totalAttendanceRecords) * 100)
      : 0;

  // 4. Map the paginated list for the UI
  const mappedStudents = students.map((s) => {
    const enrollments = s.enrollments || [];
    const avgMastery =
      enrollments.length > 0
        ? Math.round(
            enrollments.reduce((sum, e) => sum + e.progressPercentage, 0) /
              enrollments.length,
          )
        : 0;

    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      studentId: s.id.slice(-6).toUpperCase(), // Short visual ID
      class: s.studentClasses[0]?.class?.gradeLevel || 'N/A',
      mastery: avgMastery,
      profilePicture: s.profilePicture,
    };
  });

  return {
    summary: {
      totalStudents,
      engaged: engagedCount,
      noActivity: noActivityCount,
      attendanceRate: overallAttendanceRate,
    },
    students: mappedStudents,
    meta: {
      page,
      limit,
      total: totalStudents,
      totalPage: Math.ceil(totalStudents / limit),
    },
  };
};

const getSingleStudentManagementDetail = async (
  studentId: string,
  loggedInUserId: string,
  role: Role,
) => {
  // Filter enrollments and attendance if teacher
  const enrollmentWhere: any = {};
  const attendanceWhere: any = {};
  if (role === Role.TEACHER) {
    enrollmentWhere.aiCourse = {
      teacherId: loggedInUserId,
    };
    attendanceWhere.attendance = {
      aiCourse: {
        teacherId: loggedInUserId,
      },
    };
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId, role: Role.STUDENT },
    include: {
      studentProfile: true,
      studentClasses: { include: { class: true } },
      enrollments: {
        where: enrollmentWhere,
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
      },
      attendanceRecords: {
        where: attendanceWhere,
      },
    },
  });

  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const aiUserId = student.studentProfile?.aiUserId;
  const enrolledCoursesCount = student.enrollments.length;

  // Calculate Attendance Rate
  const totalAttendance = student.attendanceRecords.length;
  const presentLate = student.attendanceRecords.filter(
    (ar) => ar.status === 'PRESENT' || ar.status === 'LATE',
  ).length;
  const attendanceRate =
    totalAttendance > 0 ? Math.round((presentLate / totalAttendance) * 100) : 0;

  let totalCourseProgress = 0;
  let totalCourseMastery = 0;
  let coursesWithMasteryCount = 0;

  const courses = await Promise.all(
    student.enrollments.map(async (enrollment) => {
      const course = enrollment.aiCourse;
      if (!course) return null;

      // Progress
      const totalModulesCount = course.totalModules;
      const completedModulesCount = course.modules.filter(
        (m) =>
          m.lessonProgresses.length > 0 && m.lessonProgresses[0].isCompleted,
      ).length;
      const progressPercentage =
        totalModulesCount > 0
          ? Math.round((completedModulesCount / totalModulesCount) * 100)
          : 0;
      totalCourseProgress += progressPercentage;

      // Mastery & Modules detail
      let courseTotalMasteryScore = 0;
      let courseModWithQuizCount = 0;
      let totalLessonsInCourse = 0;
      let completedLessonsInCourse = 0;

      const modules = await Promise.all(
        course.modules.map(async (mod) => {
          const isCompleted =
            mod.lessonProgresses.length > 0 &&
            mod.lessonProgresses[0].isCompleted;

          const lessons = (mod.studyTopics as any[]) || [];
          totalLessonsInCourse += lessons.length;
          if (isCompleted) {
            completedLessonsInCourse += lessons.length;
          }

          let quizScore = null;
          let quizHistory: any[] = [];
          if (aiUserId) {
            const questionIds = mod.quizQuestions.map((q) => q.questionId);
            if (questionIds.length > 0) {
              const answers = await prisma.quizAnswer.findMany({
                where: {
                  uniqueUserId: aiUserId,
                  uniqueSessionId: course.uniqueSessionId,
                  questionId: { in: questionIds },
                },
              });

              if (answers.length > 0) {
                const correct = answers.filter((a) => a.isCorrect).length;
                quizScore = Math.round((correct / answers.length) * 100);
                courseTotalMasteryScore += quizScore;
                courseModWithQuizCount++;

                quizHistory = mod.quizQuestions.map((q) => {
                  const ans = answers.find((a) => a.questionId === q.questionId);
                  return {
                    questionId: q.questionId,
                    questionText: q.questionText,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    selectedAnswer: ans?.selectedAnswer || null,
                    correctAnswer: q.correctAnswer,
                    isCorrect: ans?.isCorrect || false,
                  };
                });
              }
            }
          }

          // Fetch teacher feedback for this module
          const feedback = await prisma.feedback.findFirst({
            where: {
              studentId,
              courseId: course.id,
              moduleId: mod.id,
            },
            orderBy: { createdAt: 'desc' },
          });

          return {
            id: mod.id,
            moduleNumber: mod.moduleNumber,
            moduleTitle: mod.moduleTitle,
            isCompleted,
            quizScore,
            totalLessons: lessons.length,
            quizHistory,
            teacherFeedback: feedback?.content || null,
          };
        }),
      );

      const courseAvgMastery =
        courseModWithQuizCount > 0
          ? Math.round(courseTotalMasteryScore / courseModWithQuizCount)
          : 0;

      if (courseModWithQuizCount > 0) {
        totalCourseMastery += courseAvgMastery;
        coursesWithMasteryCount++;
      }

      return {
        id: course.id,
        courseName: course.courseName,
        progress: progressPercentage,
        mastery: courseAvgMastery,
        modulesCompleted: completedModulesCount,
        modulesTotal: totalModulesCount,
        lessonsCompleted: completedLessonsInCourse,
        lessonsTotal: totalLessonsInCourse,
        modules,
      };
    }),
  );

  const avgProgress =
    enrolledCoursesCount > 0
      ? Math.round(totalCourseProgress / enrolledCoursesCount)
      : 0;
  const avgMastery =
    coursesWithMasteryCount > 0
      ? Math.round(totalCourseMastery / coursesWithMasteryCount)
      : 0;

  return {
    studentInfo: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.id.slice(-6).toUpperCase(),
      grade: student.studentClasses[0]?.class?.gradeLevel || 'N/A',
      profilePicture: student.profilePicture,
    },
    summaryStats: {
      enrolledCourses: enrolledCoursesCount,
      avgProgress,
      avgMastery,
      attendanceRate,
    },
    enrolledCourses: courses.filter((c) => c !== null),
  };
};


const getAdminAndTeacherList = async () => {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [Role.ADMIN, Role.TEACHER],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalAdmin = users.filter((u) => u.role === Role.ADMIN).length;
  const totalTeacher = users.filter((u) => u.role === Role.TEACHER).length;

  return {
    meta: {
      totalAdmin,
      totalTeacher,
      total: users.length,
    },
    data: users,
  };
};

export const UserService = {
  registerStudent,
  getAllStudents,
  getAllTeachers,
  getStudentById,
  updateProfile,
  deleteUser,
  getMyProfile,
  deleteMe,
  toggleUserRole,
  createUserLink,
  removeUserLink,
  getLinkedUsers,
  getStudentManagementData,
  getSingleStudentManagementDetail,
  getAdminAndTeacherList,
};

