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
    updateData.FirstName = firstName;
  }
  if (lastName) {
    updateData.LastName = lastName;
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

const deleteStudent = async (id: string) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.studentProfile.delete({
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

export const UserService = {
  registerStudent,
  getAllStudents,
  getStudentById,
  updateProfile,
  deleteStudent,
  getMyProfile,
  deleteMe,
  toggleUserRole,
  createUserLink,
  removeUserLink,
  getLinkedUsers,
};
