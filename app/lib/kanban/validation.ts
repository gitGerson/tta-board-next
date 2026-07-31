import { z } from "zod";
import {
  normalizeCommentDocument,
  type CommentDocument,
} from "@/app/lib/comments/content";
import {
  normalizeRichTextDocument,
} from "@/app/lib/rich-text/content";

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const optionalText = z
  .string()
  .trim()
  .max(5_000)
  .nullish()
  .transform((value) => value || null);
const updateOptionalText = z
  .string()
  .trim()
  .max(5_000)
  .nullable()
  .optional();
const cardTitle = z.string().trim().min(1).max(200);
const cardDate = z.date().nullable();
const cardAssigneeId = uuid.nullable();
const cardLabelIds = z.array(uuid).max(20);

export const createBoardSchema = z.object({
  name,
  description: optionalText,
});

export const deleteBoardSchema = z.object({
  boardId: uuid,
  confirmation: z.string(),
});

export const createColumnSchema = z.object({
  boardId: uuid,
  name,
});

export const renameColumnSchema = z.object({
  columnId: uuid,
  name,
});

export const moveColumnSchema = z.object({
  columnId: uuid,
  targetIndex: z.number().int().nonnegative(),
});

const labelFields = {
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color."),
};

export const createLabelSchema = z.object({
  boardId: uuid,
  ...labelFields,
});

export const updateLabelSchema = z.object({
  boardId: uuid,
  labelId: uuid,
  ...labelFields,
});

export const createCardSchema = z.object({
  columnId: uuid,
  title: cardTitle,
  description: optionalText,
  startAt: cardDate.optional().default(null),
  dueAt: cardDate.optional().default(null),
  assigneeId: cardAssigneeId.optional().default(null),
  labelIds: cardLabelIds.default([]),
});

export const updateCardSchema = z.object({
  cardId: uuid,
  title: cardTitle.optional(),
  description: updateOptionalText,
  startAt: cardDate.optional(),
  dueAt: cardDate.optional(),
  assigneeId: cardAssigneeId.optional(),
  labelIds: cardLabelIds.optional(),
});

export const updateCardDescriptionSchema = z.object({
  cardId: uuid,
  document: z.unknown().transform((value, context) => {
    if (value === null) return null;

    const document = normalizeRichTextDocument(value);
    if (document) return document;

    const emptyDocument =
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "doc" &&
      (!("content" in value) ||
        (Array.isArray(value.content) &&
          value.content.every(
            (node) =>
              typeof node === "object" &&
              node !== null &&
              "type" in node &&
              node.type === "paragraph" &&
              (!("content" in node) ||
                (Array.isArray(node.content) && node.content.length === 0)),
          )));

    if (emptyDocument) {
      return null;
    }

    context.addIssue({
      code: "custom",
      message: "The description format is invalid.",
    });
    return z.NEVER;
  }),
});

export const updateCardMembersSchema = z.object({
  cardId: uuid,
  memberIds: z.array(uuid).min(1).max(50),
  picId: uuid.nullable(),
});

export const moveCardSchema = z.object({
  cardId: uuid,
  targetColumnId: uuid,
  targetIndex: z.number().int().nonnegative(),
});

export const createCommentSchema = z.object({
  cardId: uuid,
  content: z.unknown().transform((value, context): CommentDocument => {
    const document = normalizeCommentDocument(value);

    if (!document) {
      context.addIssue({
        code: "custom",
        message: "Write a comment before submitting.",
      });

      return z.NEVER;
    }

    return document;
  }),
});

export const createChecklistGroupSchema = z.object({
  cardId: uuid,
  name,
  description: optionalText,
  picId: uuid.nullable().optional().default(null),
  startAt: z.date().nullable().optional().default(null),
  dueAt: z.date().nullable().optional().default(null),
});

export const updateChecklistGroupSchema = createChecklistGroupSchema
  .omit({ cardId: true })
  .partial()
  .extend({ groupId: uuid });

export const moveChecklistGroupSchema = z.object({
  groupId: uuid,
  targetIndex: z.number().int().nonnegative(),
});

export const createChecklistItemSchema = z.object({
  groupId: uuid,
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  dueAt: z.date().nullable().optional().default(null),
  assigneeIds: z.array(uuid).max(20).default([]),
});

export const updateChecklistItemSchema = createChecklistItemSchema
  .omit({ groupId: true })
  .partial()
  .extend({ itemId: uuid });

/** Mirrors moveCardSchema: items move between groups as cards move between columns. */
export const moveChecklistItemSchema = z.object({
  itemId: uuid,
  targetGroupId: uuid,
  targetIndex: z.number().int().nonnegative(),
});

export const setChecklistItemDoneSchema = z.object({
  itemId: uuid,
  isDone: z.boolean(),
});

export const entityIdSchema = uuid;

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type RenameColumnInput = z.infer<typeof renameColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type UpdateCardDescriptionInput = z.input<
  typeof updateCardDescriptionSchema
>;
export type UpdateCardMembersInput = z.infer<typeof updateCardMembersSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateChecklistGroupInput = z.infer<
  typeof createChecklistGroupSchema
>;
export type UpdateChecklistGroupInput = z.infer<
  typeof updateChecklistGroupSchema
>;
export type MoveChecklistGroupInput = z.infer<typeof moveChecklistGroupSchema>;
export type CreateChecklistItemInput = z.infer<
  typeof createChecklistItemSchema
>;
export type UpdateChecklistItemInput = z.infer<
  typeof updateChecklistItemSchema
>;
export type MoveChecklistItemInput = z.infer<typeof moveChecklistItemSchema>;
export type SetChecklistItemDoneInput = z.infer<
  typeof setChecklistItemDoneSchema
>;
