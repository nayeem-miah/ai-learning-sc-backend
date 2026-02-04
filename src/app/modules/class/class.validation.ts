import { z } from "zod";

const createClassSchema = z.object({
  body: z.object({
    gradeLevel: z.string().min(1, "Grade is required").trim(),
  }),
});

export const ClassValidation = {
  createClassSchema,
};
