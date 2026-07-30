-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "start_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "checklist_groups" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "pic_id" UUID,
    "start_at" TIMESTAMPTZ(3),
    "due_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item_assignees" (
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "checklist_item_assignees_pkey" PRIMARY KEY ("item_id","user_id")
);

-- CreateIndex
CREATE INDEX "checklist_groups_card_id_position_idx" ON "checklist_groups"("card_id", "position");

-- CreateIndex
CREATE INDEX "checklist_groups_pic_id_idx" ON "checklist_groups"("pic_id");

-- CreateIndex
CREATE INDEX "checklist_items_group_id_position_idx" ON "checklist_items"("group_id", "position");

-- CreateIndex
CREATE INDEX "checklist_items_is_done_idx" ON "checklist_items"("is_done");

-- CreateIndex
CREATE INDEX "checklist_items_completed_by_id_idx" ON "checklist_items"("completed_by_id");

-- CreateIndex
CREATE INDEX "checklist_item_assignees_user_id_idx" ON "checklist_item_assignees"("user_id");

-- AddForeignKey
ALTER TABLE "checklist_groups" ADD CONSTRAINT "checklist_groups_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_groups" ADD CONSTRAINT "checklist_groups_pic_id_fkey" FOREIGN KEY ("pic_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "checklist_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_assignees" ADD CONSTRAINT "checklist_item_assignees_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_assignees" ADD CONSTRAINT "checklist_item_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
