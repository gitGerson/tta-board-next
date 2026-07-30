import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { databaseConnectionString } from "@/database.config";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseConnectionString() }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
