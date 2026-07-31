INSERT INTO "card_members" ("card_id", "user_id")
SELECT "id", "created_by_id" FROM "cards"
UNION
SELECT "id", "assignee_id" FROM "cards" WHERE "assignee_id" IS NOT NULL
UNION
SELECT "card_id", "pic_id"
FROM "checklist_groups"
WHERE "pic_id" IS NOT NULL
UNION
SELECT "checklist_groups"."card_id", "checklist_item_assignees"."user_id"
FROM "checklist_item_assignees"
INNER JOIN "checklist_items"
  ON "checklist_items"."id" = "checklist_item_assignees"."item_id"
INNER JOIN "checklist_groups"
  ON "checklist_groups"."id" = "checklist_items"."group_id"
ON CONFLICT ("card_id", "user_id") DO NOTHING;
