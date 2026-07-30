import { z } from "zod";

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const optionalText = z
  .string()
  .trim()
  .max(5_000)
  .nullish()
  .transform((value) => value || null);

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

export const createLabelSchema = z.object({
  boardId: uuid,
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color."),
});

export const createCardSchema = z.object({
  columnId: uuid,
  title: z.string().trim().min(1).max(200),
  description: optionalText,
  startAt: z.date().nullable().optional().default(null),
  dueAt: z.date().nullable().optional().default(null),
  assigneeId: uuid.nullable().optional().default(null),
  labelIds: z.array(uuid).max(20).default([]),
});

export const updateCardSchema = createCardSchema
  .omit({ columnId: true })
  .partial()
  .extend({ cardId: uuid });

export const moveCardSchema = z.object({
  cardId: uuid,
  targetColumnId: uuid,
  targetIndex: z.number().int().nonnegative(),
});

export const createCommentSchema = z.object({
  cardId: uuid,
  body: z.string().trim().min(1).max(5_000),
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
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
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
