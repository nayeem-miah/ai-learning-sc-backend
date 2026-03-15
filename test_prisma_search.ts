/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { endsWith: 'a' },
      },
    });
    console.log('Success with endsWith:', users.length);
  } catch (e: any) {
    console.error('Error with endsWith:', e.message);
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { contains: 'a' },
      },
    });
    console.log('Success with contains:', users.length);
  } catch (e: any) {
    console.error('Error with contains:', e.message);
  }
}
main();
