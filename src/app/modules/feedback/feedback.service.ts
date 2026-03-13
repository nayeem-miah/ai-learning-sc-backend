/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role } from "@prisma/client";
import { prisma } from "../../prisma/prisma";
import ApiError from "../../errors/apiError";
import httpStatus from "http-status";

const createFeedback = async (teacherId: string, payload: any) => {
  const { studentId, courseId, moduleId, content } = payload;

  const result = await prisma.feedback.create({
    data: {
      teacherId,
      studentId,
      courseId,
      moduleId,
      content,
    },
  });

  return result;
};

const getStudentFeedbacks = async (studentId: string) => {
  const result = await prisma.feedback.findMany({
    where: {
      studentId,
    },
    include: {
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      },
      course: {
        select: {
          subject: true,
          courseName: true,
        },
      },
      module: {
        select: {
          moduleTitle: true,
          moduleNumber: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return result;
};

const getTeacherFeedbacks = async (teacherId: string) => {
  const result = await prisma.feedback.findMany({
    where: {
      teacherId,
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      },
      course: {
        select: {
          subject: true,
          courseName: true,
        },
      },
      module: {
        select: {
          moduleTitle: true,
          moduleNumber: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return result;
};

export const FeedbackService = {
  createFeedback,
  getStudentFeedbacks,
  getTeacherFeedbacks,
};
