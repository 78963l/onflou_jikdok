import { PrismaClient } from '@prisma/client';

// 개발 환경에서 hot reload 시 Prisma 인스턴스 중복 생성 방지
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
