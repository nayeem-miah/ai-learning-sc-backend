/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { fileUpload } from "../../utils/fileUpload";
import sendResponse from "../../utils/sendResponse";
import { UserService } from "./user.service";
import { userValidation } from "./user.validation";

const registerStudent = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.registerStudent(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Student registered successfully",
    data: result,
  });
});

const getAllStudents = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllStudents(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Students fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getMyProfile = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;

    const result = await UserService.getMyProfile(decodedUser.userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "My profile fetched successfully",
      data: result,
    });
  },
);

const getStudentById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.getStudentById(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Student fetched successfully",
    data: result,
  });
});

const updateProfile = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const userId = req.user.userId;

    // data comes as JSON string
    const parsedData = JSON.parse(req.body.data);

    const validatedData = userValidation.updateProfileSchema.parse(parsedData);

    let imageUrl: string | undefined;

    if (req.file) {
      const uploadResult = await fileUpload.uploadToCloudinary(req.file);
      imageUrl = uploadResult?.secure_url;
    }

    const payload = {
      ...validatedData,
      profilePicture: imageUrl,
    };

    const result = await UserService.updateProfile(userId, payload);

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: "Profile updated successfully",
      data: result,
    });
  },
);

const toggleUserRole = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const { id } = req.params;

    const result = await UserService.toggleUserRole(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "User role updated successfully",
      data: result,
    });
  },
);

const deleteStudent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.deleteStudent(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Student deleted successfully",
    data: result,
  });
});

const deleteMe = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const userId = req.user.userId;

    const result = await UserService.deleteMe(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Your account has been deleted successfully",
      data: result,
    });
  },
);

const createUserLink = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const { email, password } = req.body;

  const result = await UserService.createUserLink(
    userId,
    email,
    password
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User link created successfully",
    data: result,
  });
});


const removeUserLink = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const { targetUserId } = req.params;

  const result = await UserService.removeUserLink(
    userId,
    targetUserId
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });

})

const getLinkedUsers = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;

  const users = await UserService.getLinkedUsers(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Linked users fetched successfully",
    data: users,
  });
})


export const UserController = {
  registerStudent,
  getAllStudents,
  getStudentById,
  updateProfile,
  deleteStudent,
  getMyProfile,
  toggleUserRole,
  deleteMe,
  createUserLink,
  removeUserLink,
  getLinkedUsers
};
