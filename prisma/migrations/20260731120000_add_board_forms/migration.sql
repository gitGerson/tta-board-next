CREATE TYPE "FormVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX');

ALTER TABLE "checklist_items"
ADD COLUMN "pic_id" UUID,
ADD COLUMN "form_version_id" UUID;

WITH ranked_pics AS (
    SELECT
        assignments."item_id",
        assignments."user_id",
        ROW_NUMBER() OVER (
            PARTITION BY assignments."item_id"
            ORDER BY
                CASE WHEN cards."assignee_id" = assignments."user_id" THEN 0 ELSE 1 END,
                LOWER(users."display_name"),
                assignments."user_id"::text
        ) AS rank
    FROM "checklist_item_assignees" assignments
    INNER JOIN "checklist_items" items ON items."id" = assignments."item_id"
    INNER JOIN "checklist_groups" groups ON groups."id" = items."group_id"
    INNER JOIN "cards" cards ON cards."id" = groups."card_id"
    INNER JOIN "users" users ON users."id" = assignments."user_id"
)
UPDATE "checklist_items" items
SET "pic_id" = ranked_pics."user_id"
FROM ranked_pics
WHERE ranked_pics."item_id" = items."id"
  AND ranked_pics.rank = 1;

CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_versions" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FormVersionStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_sections" (
    "id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_fields" (
    "id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "section_id" UUID,
    "field_key" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "FormFieldType" NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_form_submissions" (
    "id" UUID NOT NULL,
    "checklist_item_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_form_values" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "form_field_id" UUID NOT NULL,
    "value" JSONB,
    CONSTRAINT "checklist_form_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forms_board_id_name_key_key" ON "forms"("board_id", "name_key");
CREATE INDEX "forms_board_id_archived_at_idx" ON "forms"("board_id", "archived_at");
CREATE UNIQUE INDEX "form_versions_form_id_version_key" ON "form_versions"("form_id", "version");
CREATE UNIQUE INDEX "form_versions_one_draft_per_form_idx" ON "form_versions"("form_id") WHERE "status" = 'DRAFT';
CREATE INDEX "form_versions_form_id_status_version_idx" ON "form_versions"("form_id", "status", "version");
CREATE INDEX "form_sections_form_version_id_position_idx" ON "form_sections"("form_version_id", "position");
CREATE UNIQUE INDEX "form_fields_form_version_id_field_key_key" ON "form_fields"("form_version_id", "field_key");
CREATE INDEX "form_fields_form_version_id_position_idx" ON "form_fields"("form_version_id", "position");
CREATE INDEX "form_fields_section_id_position_idx" ON "form_fields"("section_id", "position");
CREATE UNIQUE INDEX "checklist_form_submissions_checklist_item_id_revision_key" ON "checklist_form_submissions"("checklist_item_id", "revision");
CREATE INDEX "checklist_form_submissions_checklist_item_id_submitted_at_idx" ON "checklist_form_submissions"("checklist_item_id", "submitted_at");
CREATE INDEX "checklist_form_submissions_submitted_by_id_idx" ON "checklist_form_submissions"("submitted_by_id");
CREATE UNIQUE INDEX "checklist_form_values_submission_id_form_field_id_key" ON "checklist_form_values"("submission_id", "form_field_id");
CREATE INDEX "checklist_form_values_form_field_id_idx" ON "checklist_form_values"("form_field_id");
CREATE INDEX "checklist_items_pic_id_idx" ON "checklist_items"("pic_id");
CREATE INDEX "checklist_items_form_version_id_idx" ON "checklist_items"("form_version_id");

ALTER TABLE "forms" ADD CONSTRAINT "forms_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_pic_id_fkey" FOREIGN KEY ("pic_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_form_submissions" ADD CONSTRAINT "checklist_form_submissions_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_form_submissions" ADD CONSTRAINT "checklist_form_submissions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_form_submissions" ADD CONSTRAINT "checklist_form_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_form_values" ADD CONSTRAINT "checklist_form_values_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "checklist_form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_form_values" ADD CONSTRAINT "checklist_form_values_form_field_id_fkey" FOREIGN KEY ("form_field_id") REFERENCES "form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
