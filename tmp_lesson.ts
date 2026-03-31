import { prisma } from './src/app/prisma/prisma';
/* eslint-disable @typescript-eslint/no-unused-vars */
const completeLesson = async (studentId: string, lessonId: string) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Mark lesson as completed
    const progress = await tx.lessonProgress.upsert({
      where: {
        studentId_lessonId: {
          studentId,
          lessonId,
        },
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
      create: {
        studentId,
        lessonId,
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    // 2. Find the course context to update Enrollment.progressPercentage
    const module = await tx.courseLectureGenerator.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            totalModules: true,
          },
        },
      },
    });

    if (module?.course) {
      const course = module.course;
      const totalModules = course.totalModules;

      // Count completed modules for this student in this course
      const completedModules = await tx.lessonProgress.count({
        where: {
          studentId,
          isCompleted: true,
          aiLesson: {
            uniqueSessionId: module.uniqueSessionId,
          },
        },
      });

      const progressPercentage =
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : 0;

      // Update the Enrollment record
      await tx.enrollment.updateMany({
        where: {
          studentId,
          aiCourseId: course.id,
        },
        data: {
          progressPercentage,
        },
      });
    }

    return progress;
  });
};
