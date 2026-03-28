import { knowledgeFile } from '@prisma/client';
import { prisma } from '../../prisma/prisma';

const createFile = async (data: knowledgeFile): Promise<knowledgeFile> => {
  const result = await prisma.knowledgeFile.create({
    data,
  });
  return result;
};

const getAllFiles = async () => {
  const result = await prisma.knowledgeFile.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
  return result;
};

const getSingleFile = async (id: string): Promise<knowledgeFile | null> => {
  const result = await prisma.knowledgeFile.findUnique({
    where: {
      id,
    },
  });
  return result;
};

const updateFile = async (
  id: string,
  payload: Partial<knowledgeFile>,
): Promise<knowledgeFile | null> => {
  const result = await prisma.knowledgeFile.update({
    where: {
      id,
    },
    data: payload,
  });
  return result;
};

const deleteFile = async (id: string): Promise<knowledgeFile | null> => {
  const result = await prisma.knowledgeFile.delete({
    where: {
      id,
    },
  });
  return result;
};

export const KnowledgeFileService = {
  createFile,
  getAllFiles,
  getSingleFile,
  updateFile,
  deleteFile,
};
