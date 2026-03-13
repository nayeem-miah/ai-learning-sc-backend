import { z } from "zod";

export const createFeedbackValidationSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, "Student ID is required"),
    courseId: z.string().min(1, "Course ID is required"),
    moduleId: z.string().optional(),
    content: z.string().min(1, "Feedback content is required"),
  }),
});

export const feedbackValidation = {
  createFeedbackValidationSchema,
};
