import { Role } from "@prisma/client";
import { Router } from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { ClassController } from "./class.controller";
import { ClassValidation } from "./class.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(ClassValidation.createClassSchema),
  ClassController.createClass,
);

router.get(
  "/",
  // auth(Role.ADMIN, Role.TEACHER, Role.STUDENT),
  ClassController.getAllClasses,
);

router.delete(
  "/:id",
  auth(Role.ADMIN, Role.TEACHER),
  ClassController.deleteClass,
);

export const ClassRoutes = router;
