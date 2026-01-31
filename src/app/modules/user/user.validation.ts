import { z } from "zod";

export const createStudentValidationSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),

    email: z.string().email("Invalid email address"),

    password: z.string().min(6, "Password must be at least 6 characters"),

    gradeLevel: z.string().min(1, "Grade level is required"),

    interests: z.array(z.string()).optional(),

    learningPreferences: z.array(z.string()).optional(),

    goals: z.string().optional(),

    currentLevel: z.string().optional(),
  }),
});

export const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),

    currentPassword: z.string().min(6).optional(),
    newPassword: z.string().min(6).optional(),
  })
  .refine((data) => !(data.newPassword && !data.currentPassword), {
    message: "Current password is required",
    path: ["currentPassword"],
  });

export const inviteTeacherValidationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

export const registerTeacherValidationSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    token: z.string().min(1, "Invitation token is required"),
    expertise: z.array(z.string()).optional(),
    bio: z.string().optional(),
  }),
});

export const userValidation = {
  createStudentValidationSchema,
  updateProfileSchema,
};
