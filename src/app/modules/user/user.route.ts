import express from "express";
import validateRequest from "../../middlewares/validateRequest";

import { Role } from "@prisma/client";
import auth from "../../middlewares/auth";
import { fileUpload } from "../../utils/fileUpload";
import { UserController } from "./user.controller";
import { userValidation } from "./user.validation";

const router = express.Router();
// Student CRUD
router.get("/", auth(), UserController.getAllStudents);
// Existing routes
router.get(
  "/student-management",
  auth(Role.ADMIN, Role.TEACHER),
  UserController.getStudentManagementData,
);
router.get(
  "/linked-users",
  auth(Role.STUDENT, Role.ADMIN),
  UserController.getLinkedUsers,
);

router.get(
  "/student-management/:id",
  auth(Role.ADMIN, Role.TEACHER),
  UserController.getSingleStudentManagementDetail,
);

router.get(
  "/teachers",
  auth(Role.ADMIN, Role.STUDENT, Role.TEACHER),
  UserController.getAllTeachers,
);

router.get(
  "/admin-teacher-list",
  auth(Role.ADMIN),
  UserController.getAdminAndTeacherList,
);
router.get("/me", auth(), UserController.getMyProfile);
router.get("/:id", auth(), UserController.getStudentById);

router.post(
  "/student",
  validateRequest(userValidation.createStudentValidationSchema),
  UserController.registerStudent,
);
router.patch(
  "/update-profile",
  fileUpload.upload.single("file"),
  auth(Role.STUDENT, Role.ADMIN, Role.TEACHER),
  UserController.updateProfile,
);

router.post(
  "/linked-users",
  auth(Role.STUDENT, Role.ADMIN),
  // validateRequest(userValidation.createUserLinkSchema),
  UserController.createUserLink,
);

router.delete(
  "/linked-users/:targetUserId",
  auth(Role.STUDENT, Role.ADMIN),
  UserController.removeUserLink,
);

// admin access share users
router.patch("/:id", auth(Role.ADMIN), UserController.toggleUserRole);

// admin delete user account
router.delete("/:id", UserController.deleteUser);
// user delete his account
router.delete("/me/delete", auth(), UserController.deleteMe);

export const UserRoutes = router;
