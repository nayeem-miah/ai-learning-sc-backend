import { InvitationStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import config from "../../config";
import { prisma } from "../../prisma/prisma";
import emailSender from "../../utils/emailSender";

const INVITE_EXPIRES_HOURS = 48;

const sendInviteService = async (email: string, role: Role = Role.TEACHER) => {
  // already invited (pending, not expired) check
  const existing = await prisma.invite.findFirst({
    where: {
      email: email.toLowerCase(),
      status: InvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });

  if (existing) {
    throw new Error("User already invited (pending)");
  }

  // If email already registered as user, block (optional but recommended)
  const userExists = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (userExists) {
    throw new Error("User already registered with this email");
  }

  const token = crypto.randomBytes(32).toString("hex");

  const invite = await prisma.invite.create({
    data: {
      email: email.toLowerCase(),
      role,
      token,
      expiresAt: new Date(Date.now() + INVITE_EXPIRES_HOURS * 60 * 60 * 1000),
    },
  });

  const inviteLink = `${config.clientUrl}/signup?invite=${token}/&role=${role}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>You are invited to join as ${role}</h2>
      <p>Click the button below to create your account.</p>
      <a href="${inviteLink}"
        style="display:inline-block;padding:10px 16px;background:#0d1b2a;color:#fff;text-decoration:none;border-radius:6px;">
        Accept Invitation
      </a>
      <p style="margin-top:12px;">This invite will expire in ${INVITE_EXPIRES_HOURS} hours.</p>
    </div>
  `;

  await emailSender("Teacher Invitation", invite.email, html);

  return {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  };
};

// verify invite (signup page open করার সময় call করবে)
const verifyInviteService = async (token: string) => {
  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite) throw new Error("Invalid invite token");

  if (invite.status !== InvitationStatus.PENDING) {
    throw new Error("Invite already used or not available");
  }

  if (invite.expiresAt < new Date()) {
    // optional: auto mark expired
    await prisma.invite.update({
      where: { token },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new Error("Invite expired");
  }

  return {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  };
};

// accept invite (teacher registers here)
const acceptInviteService = async (
  token: string,
  firstName: string,
  lastName: string,
  password: string,
  subjectsType: string[],
) => {
  console.log(subjectsType);

  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite) throw new Error("Invalid invite");
  if (invite.status !== InvitationStatus.PENDING)
    throw new Error("Invite already used or not available");

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { token },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new Error("Invite expired");
  }

  // ensure email not already registered
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });
  if (existingUser) throw new Error("User already registered");

  const hashedPassword = await bcrypt.hash(
    password,
    config.salt_rounds as number,
  );

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        firstName,
        lastName,
        email: invite.email,
        password: hashedPassword,
        role: invite.role,
      },
      include: {
        teacherProfile: true,
      },
    });

    // ✅ যদি role TEACHER হয় → TeacherProfile create
    if (invite.role === Role.TEACHER) {
      await tx.teacherProfile.create({
        data: {
          userId: createdUser.id,
          subjectsType: subjectsType ?? [],
          expertise: [],
          bio: null,
        },
      });
    }

    await tx.invite.update({
      where: { token },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    return createdUser;
  });

  return user;
};

// const acceptInviteService = async (
//   token: string,
//   firstName: string,
//   lastName: string,
//   password: string,
// ) => {
//   const invite = await prisma.invite.findUnique({
//     where: { token },
//   });

//   if (!invite) throw new Error("Invalid invite");
//   if (invite.status !== InvitationStatus.PENDING)
//     throw new Error("Invite already used or not available");

//   if (invite.expiresAt < new Date()) {
//     await prisma.invite.update({
//       where: { token },
//       data: { status: InvitationStatus.EXPIRED },
//     });
//     throw new Error("Invite expired");
//   }

//   // ensure email not already registered
//   const existingUser = await prisma.user.findUnique({
//     where: { email: invite.email },
//     select: { id: true },
//   });
//   if (existingUser) throw new Error("User already registered");

//   const hashedPassword = await bcrypt.hash(
//     password,
//     config.salt_rounds as number,
//   );

//   const user = await prisma.$transaction(async (tx) => {
//     const createdUser = await tx.user.create({
//       data: {
//         firstName,
//         lastName,
//         email: invite.email,
//         password: hashedPassword,
//         role: invite.role,
//       },
//     });

//     await tx.invite.update({
//       where: { token },
//       data: {
//         status: InvitationStatus.ACCEPTED,
//         acceptedAt: new Date(),
//       },
//     });

//     return createdUser;
//   });

//   return user;
// };

export const InviteService = {
  sendInviteService,
  verifyInviteService,
  acceptInviteService,
};
