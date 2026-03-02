import express from "express";
import validateRequest from "../../middlewares/validateRequest";

import { Role } from "@prisma/client";
import auth from "../../middlewares/auth";
import { fileUpload } from "../../utils/fileUpload";
import { UserController } from "./user.controller";
import { userValidation } from "./user.validation";

const router = express.Router();

// Existing routes
router.post(
  "/student",
  validateRequest(userValidation.createStudentValidationSchema),
  UserController.registerStudent,
);
router.patch(
  "/update-profile",
  fileUpload.upload.single("file"),
  auth(Role.STUDENT, Role.ADMIN),
  UserController.updateProfile,
);

router.post(
  "/linked-users",
  auth(Role.STUDENT, Role.ADMIN),
  // validateRequest(userValidation.createUserLinkSchema),
  UserController.createUserLink
);

router.get(
  "/linked-users",
  auth(Role.STUDENT, Role.ADMIN),
  UserController.getLinkedUsers
);

router.delete(
  "/linked-users/:targetUserId",
  auth(Role.STUDENT, Role.ADMIN),
  // validateRequest(userValidation.removeUserLinkSchema),
  UserController.removeUserLink
);

// Student CRUD
router.get("/", auth(), UserController.getAllStudents);
router.get("/me", auth(), UserController.getMyProfile);
router.get("/:id", auth(), UserController.getStudentById);

// admin access share users
router.patch("/:id", auth(Role.ADMIN), UserController.toggleUserRole);

// admin delete user account
router.delete("/:id", UserController.deleteStudent);
// user delete his account
router.delete("/me/delete", auth(), UserController.deleteMe);

export const UserRoutes = router;
