/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";

const createClass = async (payload: { gradeLevel: string }) => {
  const { gradeLevel } = payload;

  // Check duplicate
  const existingClass = await prisma.class.findFirst({
    where: {
      gradeLevel,
    },
  });

  if (existingClass) {
    throw new ApiError(httpStatus.CONFLICT, "Class already exists");
  }

  const newClass = await prisma.class.create({
    data: {
      gradeLevel,
    },
  });

  return newClass;
};

const getAllClasses = async () => {
  const classes = await prisma.class.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // all student profiles
  const students = await prisma.studentProfile.findMany({
    select: {
      gradeLevel: true,
    },
  });

  // group count by grade
  const gradeCountMap: Record<string, number> = {};

  students.forEach((student) => {
    const grade = student.gradeLevel;
    gradeCountMap[grade] = (gradeCountMap[grade] || 0) + 1;
  });

  // attach count to class
  return classes.map((cls: any) => ({
    id: cls.id,
    gradeLevel: cls.gradeLevel,
    section: cls.section,
    studentsCount: gradeCountMap[cls.gradeLevel] || 0,
    createdAt: cls.createdAt,
  }));
};

const deleteClass = async (id: string) => {
  const classExists = await prisma.class.findUnique({
    where: { id },
  });

  if (!classExists) {
    throw new ApiError(httpStatus.NOT_FOUND, "Class not found");
  }

  const data = await prisma.class.delete({
    where: { id },
  });

  return data;
};

export const ClassService = {
  createClass,
  getAllClasses,
  deleteClass,
};
