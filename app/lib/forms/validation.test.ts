import { describe, expect, it } from "vitest";
import {
  saveChecklistFormSubmissionSchema,
  saveFormDraftSchema,
} from "./validation";

const boardId = "9cb070c7-cdbb-4aaa-8ca1-d994f4682892";
const fieldId = "3b50f45c-a170-4d03-a6bc-d3a66dff3d78";

describe("form validation", () => {
  it("accepts the core field types and optional sections", () => {
    const result = saveFormDraftSchema.parse({
      boardId,
      name: "Inspection",
      description: null,
      ungroupedFields: [
        {
          fieldKey: fieldId,
          label: "Summary",
          description: null,
          type: "TEXT",
          isRequired: true,
        },
      ],
      sections: [
        {
          title: "Measurements",
          description: null,
          fields: [
            {
              label: "Status",
              description: null,
              type: "SELECT",
              options: ["Good", "Repair"],
            },
          ],
        },
      ],
    });

    expect(result.sections[0].fields[0].options).toEqual(["Good", "Repair"]);
  });

  it("rejects option fields without options", () => {
    expect(() =>
      saveFormDraftSchema.parse({
        boardId,
        name: "Inspection",
        description: null,
        ungroupedFields: [
          {
            label: "Status",
            description: null,
            type: "CHECKBOX",
            options: [],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate options case-insensitively", () => {
    expect(() =>
      saveFormDraftSchema.parse({
        boardId,
        name: "Inspection",
        description: null,
        ungroupedFields: [
          {
            label: "Status",
            description: null,
            type: "SELECT",
            options: ["Good", "good"],
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts typed submission values with an expected revision", () => {
    expect(
      saveChecklistFormSubmissionSchema.parse({
        checklistItemId: boardId,
        formVersionId: fieldId,
        expectedRevision: 2,
        values: [{ fieldId, value: ["Good"] }],
      }).expectedRevision,
    ).toBe(2);
  });
});
