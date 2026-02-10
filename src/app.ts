import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";

const app: Application = express();

// Webhook must be before other middleware

// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "http://localhost:7270",
//       "http://206.162.244.134:7270",
//     ],
//     credentials: true,
//   }),
// );

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Welcome to scottfriedman API",
  });
});

app.set("trust proxy", 1);

app.use("/api/v1", router);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
