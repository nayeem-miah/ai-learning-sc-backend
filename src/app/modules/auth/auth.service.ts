import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';
import { jwtHelper } from '../../utils/JwtHelper';
import emailSender from '../../utils/emailSender';

const login = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });

  if (!user || !user.password) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    user.password,
  );

  if (!isCorrectPassword) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const accessToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.accessToken as string,
    config.jwt.accessTokenExpiresIn as string,
  );
  const refreshToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.refreshToken as string,
    config.jwt.refreshTokenExpiresIn as string,
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      status: user.status,
    },
  };
};

const forgotPassword = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const resetToken = jwtHelper.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.reset_pass_secret as Secret,
    config.jwt.reset_pass_token_expires_in as string,
  );

  const resetLink = `${config.reset_pass_link}?token=${resetToken}`;

  await emailSender(
    'Reset Your Password',
    userData.email,
    `
        <p>Hello ${userData.firstName || 'User'},</p>
        <p>Click the link below to reset your password:</p>
         <a href="${resetLink}" style="text-decoration: none;">
            <button style="background-color: #007BFF; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
              Reset Password
            </button>
          </a>
        <p>If you didn’t request this, ignore this email.</p>
        `,
  );

  return { message: 'Reset password email sent' };
};

const resetPassword = async (token: string, payload: { password: string }) => {
  // Verify token
  const decoded = jwtHelper.verifyToken(
    token,
    config.jwt.reset_pass_secret as Secret,
  );

  if (!decoded) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid or expired token!');
  }

  const user = await prisma.user.findUnique({
    where: {
      id: decoded.id,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.salt_rounds),
  );

  // Update password
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return { message: 'Password reset successful' };
};

export const AuthServices = {
  login,
  forgotPassword,
  resetPassword,
};
