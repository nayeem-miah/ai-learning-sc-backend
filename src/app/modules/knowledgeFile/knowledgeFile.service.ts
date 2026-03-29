/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { knowledgeFile } from '@prisma/client';
import axios from 'axios';
import config from '../../config';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';

const createFile = async (data: any): Promise<knowledgeFile> => {
  try {
    const result = await prisma.knowledgeFile.create({
      data,
    });

    const aiResponse = await axios.post(
      `${config.AI_BASE_API}/api/v1/knowledge-bases`,
      {
        name: result.fileName,
        source_url: result.fileUrl,
        chunk_size: 1000,
        chunk_overlap: 200,
        metadata: {},
      },
      {
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );

    // 3️⃣ Validate AI response
    if (
      !aiResponse.data ||
      !aiResponse.data.success ||
      !aiResponse.data.data?.kb_id
    ) {
      throw new ApiError(502, 'AI did not return a valid knowledge base id');
    }

    const kbId = aiResponse.data.data.kb_id;

    const updatedResult = await prisma.knowledgeFile.update({
      where: { id: result.id },
      data: { kbId },
    });

    return updatedResult;
  } catch (error) {
    console.error('Create File Failed:', error);

    // optional: rollback (delete created record)
    if (data?.id) {
      await prisma.knowledgeFile
        .delete({
          where: { id: data.id },
        })
        .catch(() => {});
    }

    throw new Error('File creation failed completely');
  }
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
  const result = await (prisma.knowledgeFile.update as any)({
    where: {
      id,
    },
    data: payload,
  });
  return result;
};

const deleteFile = async (id: string): Promise<knowledgeFile> => {
  let record: any = null;

  try {
    record = await prisma.knowledgeFile.findUnique({
      where: { id },
    });

    if (!record) {
      throw new Error('Knowledge file not found');
    }
    console.log(record);
    console.log(record.kbId);

    if (record.kbId) {
      const aiResponse = await axios.delete(
        `${config.AI_BASE_API}/api/v1/knowledge-bases/${record.kbId}`,
        {
          headers: {
            accept: 'application/json',
          },
        },
      );

      // optional validation
      if (!aiResponse?.data?.success) {
        throw new Error('AI delete failed');
      }
    }

    const result = await prisma.knowledgeFile.delete({
      where: { id },
    });

    return result;
  } catch (error) {
    console.error('Delete File Failed:', error);

    throw new Error('File deletion failed completely');
  }
};

export const KnowledgeFileService = {
  createFile,
  getAllFiles,
  getSingleFile,
  updateFile,
  deleteFile,
};
