import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { databaseConnectionString } from "./database.config";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseConnectionString(),
  },
});
