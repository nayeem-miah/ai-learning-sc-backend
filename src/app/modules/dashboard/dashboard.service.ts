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

export const DashboardService = {
  getDashboardData,
};
