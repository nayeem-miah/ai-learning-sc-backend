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


const createUserLink = async (loggedInUserId: string, email: string, password: string) => {
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { email },
  });

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const isMatch = await bcrypt.compare(password, targetUser.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid password");
  }

  const targetUserId = targetUser.id;

  if (loggedInUserId === targetUserId) {
    throw new Error("You cannot link yourself");
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
    throw new ApiError(401, "Already linked");
  }

  // create mutual link
  const userLink = await prisma.userLink.create({
    data: {
      fromId: loggedInUserId,
      toId: targetUserId,
    },
  });

  await prisma.userLink.create({
    data: {
      fromId: targetUserId,
      toId: loggedInUserId,
    },
  });

  return userLink;
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

  return { message: "User unlinked successfully" };
};

const getLinkedUsers = async (loggedInUserId: string) => {

  const loggedInUser = await prisma.user.findUnique({
    where: { id: loggedInUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      role: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      studentProfile: {
        select: {
          id: true,
          gradeLevel: true,
          interests: true,
          learningPreferences: true,
          goals: true,
          currentLevel: true,
        },
      },
    },
  });


  const links = await prisma.userLink.findMany({
    where: {
      OR: [
        { fromId: loggedInUserId },
        { toId: loggedInUserId },
      ],
    },
    select: {
      fromId: true,
      toId: true,
      from: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          studentProfile: {
            select: {
              id: true,
              gradeLevel: true,
              interests: true,
              learningPreferences: true,
              goals: true,
              currentLevel: true,
            },
          },
        },
      },
      to: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          studentProfile: {
            select: {
              id: true,
              gradeLevel: true,
              interests: true,
              learningPreferences: true,
              goals: true,
              currentLevel: true,
            },
          },
        },
      },
    },
  });

  // 3️ Extract connected users
  const linkedUsers = links.map(link =>
    link.fromId === loggedInUserId ? link.to : link.from
  );

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
