"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import {
  archiveForm,
  loadChecklistFormWorkspace,
  publishForm,
  saveChecklistFormSubmission,
  saveFormDraft,
} from "./form-service";
import type {
  ChecklistFormWorkspaceDTO,
} from "./types";
import type {
  SaveChecklistFormSubmissionInput,
  SaveFormDraftInput,
} from "./validation";
import { notifyChanged, resolveBoardId } from "@/app/lib/realtime/notify";

export type FormActionResult =
  | { ok: true; id?: string; updatedAt?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type WorkspaceActionResult =
  | { ok: true; data: ChecklistFormWorkspaceDTO }
  | { ok: false; message: string };

function failure(error: unknown): FormActionResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      message: "Check the submitted values.",
      fieldErrors: z.flattenError(error).fieldErrors,
    };
  }
  if (error instanceof ConflictError || error instanceof NotFoundError) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "The operation could not be completed." };
}

export async function saveFormDraftAction(
  input: SaveFormDraftInput,
): Promise<FormActionResult> {
  try {
    const result = await saveFormDraft(input);
    revalidatePath("/", "layout");
    return { ok: true, id: result.id, updatedAt: result.updatedAt };
  } catch (error) {
    return failure(error);
  }
}

export async function publishFormAction(
  formId: string,
): Promise<FormActionResult> {
  try {
    await publishForm(formId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveFormAction(
  formId: string,
): Promise<FormActionResult> {
  try {
    await archiveForm(formId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function loadChecklistFormWorkspaceAction(
  checklistItemId: string,
): Promise<WorkspaceActionResult> {
  try {
    return {
      ok: true,
      data: await loadChecklistFormWorkspace(checklistItemId),
    };
  } catch {
    return { ok: false, message: "Only the checklist PIC can open this form." };
  }
}

export async function saveChecklistFormSubmissionAction(
  input: SaveChecklistFormSubmissionInput,
): Promise<FormActionResult> {
  try {
    const result = await saveChecklistFormSubmission(input);
    revalidatePath("/", "layout");
    const boardId = await resolveBoardId({
      kind: "checklistItem",
      itemId: input.checklistItemId,
    });
    await notifyChanged(boardId, false);
    return { ok: true, id: result.id };
  } catch (error) {
    return failure(error);
  }
}
