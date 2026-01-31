import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import config from "../config";
import { prisma } from "../prisma/prisma";

interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export const seedAdmin = async () => {
  const payload: IUser = {
    firstName: "Admin",
    lastName: "website",
    email: config.admin.email as string,
    role: Role.ADMIN,
  };
  const hashedPassword = await bcrypt.hash(
    config.admin.password as string,
    config.salt_rounds as number,
  );

  const isExistUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (isExistUser) return;

  const result = await prisma.user.create({
    data: { ...payload, password: hashedPassword },
  });

  console.log(result);
};
