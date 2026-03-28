import { z } from 'zod';

const createKnowledgeFileZodSchema = z.object({
  body: z.object({
    fileName: z.string().min(1, 'File name is required'),
    fileUrl: z.string().min(1, 'File URL is required'),
    fileSize: z.number().positive('File size must be positive'),
    fileType: z.string().min(1, 'File type is required'),
  }),
});

const updateKnowledgeFileZodSchema = z.object({
  body: z.object({
    fileName: z.string().optional(),
    fileUrl: z.string().optional(),
    fileSize: z.number().positive().optional(),
    fileType: z.string().optional(),
  }),
});

export const KnowledgeFileValidation = {
  createKnowledgeFileZodSchema,
  updateKnowledgeFileZodSchema,
};
