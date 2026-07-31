export type FormFieldTypeDTO =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "CHECKBOX";

export type FormFieldDTO = {
  id: string;
  fieldKey: string;
  label: string;
  description: string | null;
  type: FormFieldTypeDTO;
  options: string[];
  isRequired: boolean;
};

export type FormSectionDTO = {
  id: string;
  title: string;
  description: string | null;
  fields: FormFieldDTO[];
};

export type FormVersionDTO = {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED";
  name: string;
  description: string | null;
  updatedAt: string;
  ungroupedFields: FormFieldDTO[];
  sections: FormSectionDTO[];
};

export type BoardFormDTO = {
  id: string;
  name: string;
  archivedAt: string | null;
  draft: FormVersionDTO | null;
  published: FormVersionDTO | null;
};

export type PublishedFormOptionDTO = {
  formId: string;
  versionId: string;
  name: string;
  version: number;
};

export type FormRevisionDTO = {
  id: string;
  revision: number;
  submittedAt: string;
  submittedBy: string;
  formVersion: FormVersionDTO;
  values: Record<string, unknown>;
};

export type ChecklistFormWorkspaceDTO = {
  checklistItemId: string;
  title: string;
  assignedVersion: FormVersionDTO | null;
  revisions: FormRevisionDTO[];
};
