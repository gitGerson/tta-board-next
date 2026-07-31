import { z } from "zod";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(2_000).nullable();
const fieldType = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
]);

const formField = z
  .object({
    fieldKey: uuid.optional(),
    label: z.string().trim().min(1).max(150),
    description: optionalText,
    type: fieldType,
    options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    isRequired: z.boolean().default(false),
  })
  .superRefine((field, context) => {
    const usesOptions = field.type === "SELECT" || field.type === "CHECKBOX";
    if (usesOptions && field.options.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Select and checkbox fields need at least one option.",
      });
    }
    if (new Set(field.options.map((option) => option.toLowerCase())).size !== field.options.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Field options must be unique.",
      });
    }
  });

const formSection = z.object({
  title: z.string().trim().min(1).max(100),
  description: optionalText,
  fields: z.array(formField).max(100),
});

export const saveFormDraftSchema = z.object({
  boardId: uuid,
  formId: uuid.optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  name: z.string().trim().min(1).max(100),
  description: optionalText,
  ungroupedFields: z.array(formField).max(100).default([]),
  sections: z.array(formSection).max(30).default([]),
});

export const formIdSchema = uuid;

export const saveChecklistFormSubmissionSchema = z.object({
  checklistItemId: uuid,
  formVersionId: uuid,
  expectedRevision: z.number().int().nonnegative(),
  values: z
    .array(z.object({ fieldId: uuid, value: z.unknown() }))
    .max(200),
});

export type SaveFormDraftInput = z.infer<typeof saveFormDraftSchema>;
export type SaveChecklistFormSubmissionInput = z.infer<
  typeof saveChecklistFormSubmissionSchema
>;
