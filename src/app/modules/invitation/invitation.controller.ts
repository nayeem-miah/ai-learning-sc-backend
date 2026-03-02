import { Role } from "@prisma/client";
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { InviteService } from "./invitation.service";

const sendInvite = catchAsync(async (req: Request, res: Response) => {
  const { email, role } = req.body;

  const result = await InviteService.sendInviteService(
    email,
    role ?? Role.TEACHER,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Invite email sent successfully",
    data: result,
  });
});

const verifyInvite = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;

  const invite = await InviteService.verifyInviteService(token as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Invite verified successfully",
    data: invite,
  });
});

// const acceptInvite = catchAsync(async (req: Request, res: Response) => {
//   const { token, firstName, lastName, password } = req.body;

//   const user = await InviteService.acceptInviteService(
//     token,
//     firstName,
//     lastName,
//     password,
//   );

//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: "Invite accepted successfully",
//     data: user,
//   });
// });

const acceptInvite = catchAsync(async (req: Request, res: Response) => {
  const { token, firstName, lastName, password, subjectsType } = req.body;

  const user = await InviteService.acceptInviteService(
    token,
    firstName,
    lastName,
    password,
    subjectsType,
  );

  console.log(user);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Invite accepted successfully",
    data: user,
  });
});

export const InviteController = {
  sendInvite,
  verifyInvite,
  acceptInvite,
};
