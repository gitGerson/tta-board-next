import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../app/generated/prisma/client";
import { databaseConnectionString } from "../database.config";

config({ path: [".env.local", ".env"], quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseConnectionString() }),
});

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  board: "20000000-0000-4000-8000-000000000001",
  todo: "30000000-0000-4000-8000-000000000001",
  progress: "30000000-0000-4000-8000-000000000002",
  review: "30000000-0000-4000-8000-000000000003",
  done: "30000000-0000-4000-8000-000000000004",
  designLabel: "40000000-0000-4000-8000-000000000001",
  systemLabel: "40000000-0000-4000-8000-000000000002",
  card: "50000000-0000-4000-8000-000000000001",
  comment: "60000000-0000-4000-8000-000000000001",
} as const;

async function seed(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: ids.user },
      update: {
        displayName: "Sample User",
        email: "sample@example.com",
        isActive: true,
      },
      create: {
        id: ids.user,
        ldapGuid: "development-sample-user",
        username: "sample.user",
        displayName: "Sample User",
        email: "sample@example.com",
        lastLoginAt: new Date(),
      },
    });

    await tx.board.upsert({
      where: { id: ids.board },
      update: {
        routeKey: "2bbMVYpomAVjUHgE",
        name: "Product Board",
        description: "Development seed board",
      },
      create: {
        id: ids.board,
        routeKey: "2bbMVYpomAVjUHgE",
        name: "Product Board",
        description: "Development seed board",
        createdById: ids.user,
      },
    });

    for (const column of [
      { id: ids.todo, name: "To Do", position: 0 },
      { id: ids.progress, name: "In Progress", position: 1 },
      { id: ids.review, name: "Review", position: 2 },
      { id: ids.done, name: "Done", position: 3 },
    ]) {
      await tx.boardColumn.upsert({
        where: { id: column.id },
        update: { name: column.name, position: column.position },
        create: { ...column, boardId: ids.board },
      });
    }

    for (const label of [
      { id: ids.designLabel, name: "Design", color: "#8b5cf6" },
      { id: ids.systemLabel, name: "System", color: "#0ea5e9" },
    ]) {
      await tx.label.upsert({
        where: { id: label.id },
        update: { name: label.name, color: label.color },
        create: { ...label, boardId: ids.board },
      });
    }

    await tx.card.upsert({
      where: { id: ids.card },
      update: {
        title: "Design System Audit",
        description: "Review and update component library",
        position: 0,
      },
      create: {
        id: ids.card,
        columnId: ids.todo,
        title: "Design System Audit",
        description: "Review and update component library",
        position: 0,
        assigneeId: ids.user,
        createdById: ids.user,
      },
    });

    for (const labelId of [ids.designLabel, ids.systemLabel]) {
      await tx.cardLabel.upsert({
        where: { cardId_labelId: { cardId: ids.card, labelId } },
        update: {},
        create: { cardId: ids.card, labelId },
      });
    }

    await tx.comment.upsert({
      where: { id: ids.comment },
      update: { body: "Seeded comment for local development." },
      create: {
        id: ids.comment,
        cardId: ids.card,
        authorId: ids.user,
        body: "Seeded comment for local development.",
      },
    });
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
