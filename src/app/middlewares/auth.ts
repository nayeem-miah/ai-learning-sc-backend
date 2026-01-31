/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import httpStatus from 'http-status';
import { jwtHelper } from "../utils/JwtHelper";
import ApiError from "../errors/apiError";

const auth = (...roles: string[]) => {
    return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
        try {
            let user;

            const token = req.cookies.accessToken || req.headers.authorization;

            if (token) {
                const secret = process.env.JWT_ACCESS_SECRET as string;
                const verifyUser = jwtHelper.verifyToken(token, secret);
                user = verifyUser;
            }

            if (!user) {
                throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
            }

            req.user = user;

            if (roles.length && !roles.includes(user.role)) {
                throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to access this resource!");
            }

            next();
        }
        catch (err) {
            next(err);
        }
    }
}

export default auth;
