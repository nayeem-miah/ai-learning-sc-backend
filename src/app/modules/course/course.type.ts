import { CourseType } from "@prisma/client";

export interface CreateCoursePayload {
  title: string;
  subject: string;
  description?: string | null;
  level: string;

  courseType: CourseType;
  semesterCount?: number | null;
  semesterLength?: number | null;

  quizzesPerModule: number;
  totalQuizQuestions: number;

  hasMidterm?: boolean;
  hasFinal?: boolean;

  masteryRequirement: number;
  totalModules: number;
  estimatedClassDuration: number;

  diagnosticTest?: boolean;
  retestingAllowed?: boolean;
  retestingCount?: number | null;

  teacherId: string;
}
