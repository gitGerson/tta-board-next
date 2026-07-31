"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/app/dashboard/_components/modal";
import {
  loadChecklistFormWorkspaceAction,
  saveChecklistFormSubmissionAction,
} from "@/app/lib/forms/actions";
import type {
  FormFieldDTO,
  FormVersionDTO,
  ChecklistFormWorkspaceDTO,
} from "@/app/lib/forms/types";

function allFields(version: FormVersionDTO): FormFieldDTO[] {
  return [
    ...version.ungroupedFields,
    ...version.sections.flatMap((section) => section.fields),
  ];
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FormFieldDTO;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const base =
    "w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#689f38] disabled:bg-slate-50";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">
        {field.label}
        {field.isRequired && <span className="ml-1 text-red-500">*</span>}
      </span>
      {field.description && (
        <span className="mb-1 block text-xs text-slate-400">
          {field.description}
        </span>
      )}
      {field.type === "TEXTAREA" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${base} min-h-24 py-2`}
        />
      ) : field.type === "SELECT" ? (
        <select
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${base} h-9`}
        >
          <option value="">Select</option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "CHECKBOX" ? (
        <span className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-2">
          {field.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <span key={option} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={(event) => {
                    const current = Array.isArray(value)
                      ? value.filter((row): row is string => typeof row === "string")
                      : [];
                    onChange(
                      event.target.checked
                        ? [...new Set([...current, option])]
                        : current.filter((row) => row !== option),
                    );
                  }}
                />
                {option}
              </span>
            );
          })}
        </span>
      ) : (
        <input
          type={
            field.type === "NUMBER"
              ? "number"
              : field.type === "DATE"
                ? "date"
                : "text"
          }
          value={
            typeof value === "string" || typeof value === "number" ? value : ""
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              field.type === "NUMBER"
                ? event.target.value === ""
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          className={`${base} h-9`}
        />
      )}
    </label>
  );
}

export function ChecklistFormModal({
  itemId,
  onClose,
}: {
  itemId: string;
  onClose: () => void;
}) {
  const [workspace, setWorkspace] =
    useState<ChecklistFormWorkspaceDTO | null>(null);
  const [selectedRevision, setSelectedRevision] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("Loading form…");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    loadChecklistFormWorkspaceAction(itemId).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setWorkspace(result.data);
      const latest = result.data.revisions[0];
      setValues(
        latest &&
          result.data.assignedVersion &&
          latest.formVersion.id === result.data.assignedVersion.id
          ? latest.values
          : {},
      );
      setMessage("");
    });
    return () => {
      active = false;
    };
  }, [itemId]);

  const revision =
    selectedRevision > 0
      ? workspace?.revisions.find((row) => row.revision === selectedRevision)
      : null;
  const version = revision?.formVersion ?? workspace?.assignedVersion ?? null;
  const sections = useMemo(
    () =>
      version
        ? [
            {
              id: "ungrouped",
              title: "",
              fields: version.ungroupedFields,
            },
            ...version.sections,
          ]
        : [],
    [version],
  );

  function chooseRevision(revisionNumber: number) {
    setSelectedRevision(revisionNumber);
    if (revisionNumber === 0) {
      const latest = workspace?.revisions[0];
      setValues(
        latest &&
          workspace?.assignedVersion &&
          latest.formVersion.id === workspace.assignedVersion.id
          ? latest.values
          : {},
      );
    }
  }

  function save() {
    if (!workspace?.assignedVersion) return;
    startTransition(async () => {
      const result = await saveChecklistFormSubmissionAction({
        checklistItemId: workspace.checklistItemId,
        formVersionId: workspace.assignedVersion!.id,
        expectedRevision: workspace.revisions[0]?.revision ?? 0,
        values: allFields(workspace.assignedVersion!).map((field) => ({
          fieldId: field.id,
          value: values[field.id] ?? null,
        })),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const refreshed = await loadChecklistFormWorkspaceAction(itemId);
      if (refreshed.ok) {
        setWorkspace(refreshed.data);
        setSelectedRevision(0);
        setMessage("Revision saved.");
      }
    });
  }

  return (
    <Modal
      title={workspace?.title ?? "Checklist form"}
      description={
        version ? `${version.name} · version ${version.version}` : undefined
      }
      size="lg"
      onClose={onClose}
    >
      <div className="max-h-[75vh] overflow-y-auto p-5">
        {workspace && workspace.revisions.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">View</label>
            <select
              value={selectedRevision}
              onChange={(event) => chooseRevision(Number(event.target.value))}
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            >
              {workspace.assignedVersion && (
                <option value={0}>New revision</option>
              )}
              {workspace.revisions.map((row) => (
                <option key={row.id} value={row.revision}>
                  Revision {row.revision} · {new Date(row.submittedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}
        {message && (
          <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {message}
          </p>
        )}
        {revision && (
          <p className="mb-3 text-xs text-slate-500">
            Saved by {revision.submittedBy}
          </p>
        )}
        {sections.map((section) =>
          section.fields.length > 0 ? (
            <section key={section.id} className="mb-5">
              {section.title && (
                <h3 className="mb-2 border-b border-slate-200 pb-2 text-sm font-bold">
                  {section.title}
                </h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={
                      revision
                        ? revision.values[field.id]
                        : values[field.id]
                    }
                    disabled={Boolean(revision)}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: value,
                      }))
                    }
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        {workspace?.assignedVersion && !revision && (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="h-9 rounded-lg bg-[#689f38] px-4 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save revision"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
