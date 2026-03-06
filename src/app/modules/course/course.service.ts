import { prisma } from '../../prisma/prisma';
import { CreateCoursePayload } from './course.type';

const createCourse = async (payload: CreateCoursePayload) => {
  const course = await prisma.course.create({
    data: payload,
  });

  // find students with same grade
  const students = await prisma.studentProfile.findMany({
    where: {
      gradeLevel: payload.level,
    },
    select: {
      userId: true,
    },
  });

  // prepare enrollments
  const enrollments = students.map((student) => ({
    studentId: student.userId,
    courseId: course.id,
  }));

  // bulk enrollment
  if (enrollments.length > 0) {
    await prisma.enrollment.createMany({
      data: enrollments,
    });
  }

  return course;
};

const getAllCourses = async () => {
  const course = await prisma.course.findMany({
    include: {
      teacher: true,
      class: true,
      attendances: true,
      enrollments: true,
      lessons: true,
    },
  });

  if (!course) {
    throw new Error('No course found');
  }
  return course;
};

const getMyCourses = async (teacherId: string) => {
  return prisma.course.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: true,
      class: true,
      attendances: true,
      enrollments: true,
      lessons: true,
    },
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
  getAllCourses,
};
