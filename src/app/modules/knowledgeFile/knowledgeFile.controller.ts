/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import ApiError from '../../errors/apiError';
import catchAsync from '../../utils/catchAsync';
import { fileUpload } from '../../utils/fileUpload';
import sendResponse from '../../utils/sendResponse';
import { KnowledgeFileService } from './knowledgeFile.service';

const createKnowledgeFile = catchAsync(async (req: Request, res: Response) => {
  if (!req.file || req.file.mimetype !== 'application/pdf') {
    throw new ApiError(400, 'Please upload a PDF file');
  }

  const uploadResult = await fileUpload.uploadToCloudinary(req.file);

  if (!uploadResult || !uploadResult.secure_url) {
    throw new ApiError(400, 'File upload failed');
  }

  const knowledgeFileData = {
    fileName: req.file.originalname,
    fileUrl: uploadResult.secure_url,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
  };

  const result = await KnowledgeFileService.createFile(
    knowledgeFileData as any,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Knowledge File uploaded and created successfully',
    data: result,
  });
});

const getAllKnowledgeFiles = catchAsync(async (req: Request, res: Response) => {
  const result = await KnowledgeFileService.getAllFiles();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Knowledge Files retrieved successfully',
    data: result,
  });
});

const getSingleKnowledgeFile = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await KnowledgeFileService.getSingleFile(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Knowledge File retrieved successfully',
      data: result,
    });
  },
);

const updateKnowledgeFile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await KnowledgeFileService.updateFile(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Knowledge File updated successfully',
    data: result,
  });
});

const deleteKnowledgeFile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await KnowledgeFileService.deleteFile(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Knowledge File deleted successfully',
    data: result,
  });
});

export const KnowledgeFileController = {
  createKnowledgeFile,
  getAllKnowledgeFiles,
  getSingleKnowledgeFile,
  updateKnowledgeFile,
  deleteKnowledgeFile,
};
