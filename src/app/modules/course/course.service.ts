import { Course } from "@prisma/client";
import { prisma } from "../../prisma/prisma";
import { CreateCoursePayload } from "./course.type";

const createCourse = async (payload: CreateCoursePayload): Promise<Course> => {
  return prisma.course.create({
    data: payload,
  });
};

const getMyCourses = async (teacherId: string) => {
  return prisma.course.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
  });
};

const getSingleCourse = async (id: string, teacherId: string) => {
  return prisma.course.findFirst({
    where: {
      id,
      teacherId,
    },
  });
};

const updateCourse = async (
  id: string,
  teacherId: string,
  payload: Partial<CreateCoursePayload>,
) => {
  return prisma.course.update({
    where: {
      id,
      teacherId,
    },
    data: payload,
  });
};

const deleteCourse = async (id: string, teacherId: string) => {
  return prisma.course.delete({
    where: {
      id,
      teacherId,
    },
  });
};

export const CourseService = {
  createCourse,
  getMyCourses,
  getSingleCourse,
  updateCourse,
  deleteCourse,
};
