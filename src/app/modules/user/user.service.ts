/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role, Status } from "@prisma/client";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";

const registerStudent = async (payload: any) => {
  const { firstName, lastName, email, password, gradeLevel } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // 🔐 TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: Role.STUDENT,
        status: Status.ACTIVE,
        profilePicture:
          "https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg",
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        gradeLevel,
      },
    });

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
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
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
    },
  });
  return result;
};

const getStudentById = async (id: string) => {
  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      role: "STUDENT",
    },
    include: {
      studentProfile: true,
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
    throw new Error("User not found");
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
      throw new Error("Current password is incorrect");
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
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
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

export const UserService = {
  registerStudent,
  getAllStudents,
  getStudentById,
  updateProfile,
  deleteStudent,
  getMyProfile,
  deleteMe,
  toggleUserRole,
};
