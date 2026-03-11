import { Router } from "express";
import auth from "../../middlewares/auth";
import { CourseSetupController } from "./courseSetup.controller";

const router = Router();
// const router = express.Router();

router.post("/setup", auth("ADMIN"), CourseSetupController.courseSetup);

router.get("/all", CourseSetupController.getAllCourses);

router.get("/:session_id", CourseSetupController.getCourseBySession);

export const CourseSetupRoutes = router;
