import { NotificationType } from "@prisma/client";
import { prisma } from "../../prisma/prisma";

const createNotification = async (data: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
}) => {
  return await prisma.notification.create({
    data,
  });
};

const getMyNotifications = async (userId: string) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

const markAsRead = async (id: string) => {
  return await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
};

const markAllAsRead = async (userId: string) => {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

export const NotificationService = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
