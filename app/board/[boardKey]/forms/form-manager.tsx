"use client";

import { Archive, ArrowDown, ArrowUp, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  archiveFormAction,
  publishFormAction,
  saveFormDraftAction,
} from "@/app/lib/forms/actions";
import type {
  BoardFormDTO,
  FormFieldDTO,
  FormFieldTypeDTO,
  FormVersionDTO,
} from "@/app/lib/forms/types";

type FieldDraft = Omit<FormFieldDTO, "id">;
type SectionDraft = {
  title: string;
  description: string | null;
  fields: FieldDraft[];
};
type EditorDraft = {
  formId?: string;
  expectedUpdatedAt?: string;
  name: string;
  description: string | null;
  ungroupedFields: FieldDraft[];
  sections: SectionDraft[];
};

const TYPES: Array<{ value: FormFieldTypeDTO; label: string }> = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Textarea" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "CHECKBOX", label: "Checkbox" },
];

function newField(): FieldDraft {
  return {
    fieldKey: crypto.randomUUID(),
    label: "",
    description: null,
    type: "TEXT",
    options: [],
    isRequired: false,
  };
}

function fromVersion(form: BoardFormDTO, version: FormVersionDTO): EditorDraft {
  const field = (row: FormFieldDTO): FieldDraft => ({
    fieldKey: row.fieldKey,
    label: row.label,
    description: row.description,
    type: row.type,
    options: row.options,
    isRequired: row.isRequired,
  });
  return {
    formId: form.id,
    expectedUpdatedAt: form.draft?.updatedAt,
    name: version.name,
    description: version.description,
    ungroupedFields: version.ungroupedFields.map(field),
    sections: version.sections.map((section) => ({
      title: section.title,
      description: section.description,
      fields: section.fields.map(field),
    })),
  };
}

function blankDraft(): EditorDraft {
  return {
    name: "",
    description: null,
    ungroupedFields: [newField()],
    sections: [],
  };
}

function FieldEditor({
  field,
  onChange,
  onRemove,
  onMove,
}: {
  field: FieldDraft;
  onChange: (field: FieldDraft) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
}) {
  const optionType = field.type === "SELECT" || field.type === "CHECKBOX";
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[1fr_9rem_auto]">
      <input
        value={field.label}
        onChange={(event) => onChange({ ...field, label: event.target.value })}
        placeholder="Field label"
        className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-[#689f38]"
      />
      <select
        value={field.type}
        onChange={(event) =>
          onChange({
            ...field,
            type: event.target.value as FormFieldTypeDTO,
            options: ["SELECT", "CHECKBOX"].includes(event.target.value)
              ? field.options
              : [],
          })
        }
        className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
      >
        {TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <span className="flex">
        <button type="button" onClick={() => onMove(-1)} className="grid size-9 place-items-center text-slate-400"><ArrowUp size={14} /></button>
        <button type="button" onClick={() => onMove(1)} className="grid size-9 place-items-center text-slate-400"><ArrowDown size={14} /></button>
        <button type="button" onClick={onRemove} className="px-2 text-xs font-bold text-red-500">Remove</button>
      </span>
      <input
        value={field.description ?? ""}
        onChange={(event) => onChange({ ...field, description: event.target.value || null })}
        placeholder="Help text (optional)"
        className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs sm:col-span-2"
      />
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <input
          type="checkbox"
          checked={field.isRequired}
          onChange={(event) => onChange({ ...field, isRequired: event.target.checked })}
        />
        Required
      </label>
      {optionType && (
        <input
          value={field.options.join(", ")}
          onChange={(event) =>
            onChange({
              ...field,
              options: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          placeholder="Options separated by commas"
          className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs sm:col-span-3"
        />
      )}
    </div>
  );
}

export function FormManager({
  boardId,
  forms,
}: {
  boardId: string;
  forms: BoardFormDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(forms[0]?.id ?? null);
  const selected = forms.find((form) => form.id === selectedId) ?? null;
  const initial = useMemo(
    () =>
      selected
        ? fromVersion(selected, selected.draft ?? selected.published!)
        : blankDraft(),
    [selected],
  );
  const [draft, setDraft] = useState<EditorDraft>(initial);
  const [message, setMessage] = useState("");

  function choose(form: BoardFormDTO | null) {
    setSelectedId(form?.id ?? null);
    setDraft(
      form ? fromVersion(form, form.draft ?? form.published!) : blankDraft(),
    );
    setMessage("");
  }

  function moveField(sectionIndex: number | null, index: number, offset: number) {
    const next = structuredClone(draft);
    const fields =
      sectionIndex === null
        ? next.ungroupedFields
        : next.sections[sectionIndex].fields;
    const target = index + offset;
    if (target < 0 || target >= fields.length) return;
    [fields[index], fields[target]] = [fields[target], fields[index]];
    setDraft(next);
  }

  function renderFields(fields: FieldDraft[], sectionIndex: number | null) {
    return fields.map((field, index) => (
      <FieldEditor
        key={field.fieldKey}
        field={field}
        onChange={(value) => {
          const next = structuredClone(draft);
          (sectionIndex === null
            ? next.ungroupedFields
            : next.sections[sectionIndex].fields)[index] = value;
          setDraft(next);
        }}
        onMove={(offset) => moveField(sectionIndex, index, offset)}
        onRemove={() => {
          const next = structuredClone(draft);
          const target =
            sectionIndex === null
              ? next.ungroupedFields
              : next.sections[sectionIndex].fields;
          target.splice(index, 1);
          setDraft(next);
        }}
      />
    ));
  }

  function saveDraft() {
    startTransition(async () => {
      const result = await saveFormDraftAction({ boardId, ...draft });
      setMessage(result.ok ? "Draft saved." : result.message);
      if (result.ok) {
        if (result.id) setSelectedId(result.id);
        if (result.updatedAt) {
          setDraft((current) => ({
            ...current,
            formId: result.id ?? current.formId,
            expectedUpdatedAt: result.updatedAt,
          }));
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <button type="button" onClick={() => choose(null)} className="mb-3 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-[#689f38] text-sm font-bold text-white"><Plus size={15} /> New form</button>
        <div className="space-y-1">
          {forms.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => choose(form)}
              className={`w-full rounded-lg px-3 py-2 text-left ${selectedId === form.id ? "bg-[#edf6e5]" : "hover:bg-slate-50"}`}
            >
              <span className="block truncate text-sm font-bold">{form.name}</span>
              <span className="text-[11px] text-slate-400">
                {form.archivedAt ? "Archived" : form.draft ? `Draft v${form.draft.version}` : form.published ? `Published v${form.published.version}` : "New"}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Form name" className="h-10 rounded-lg border border-slate-300 px-3 font-bold outline-none focus:border-[#689f38]" />
          <input value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value || null })} placeholder="Description (optional)" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-extrabold uppercase text-slate-500">Ungrouped fields</h3><button type="button" onClick={() => setDraft({ ...draft, ungroupedFields: [...draft.ungroupedFields, newField()] })} className="text-xs font-bold text-[#5c8f32]">+ Field</button></div>
          <div className="space-y-2">{renderFields(draft.ungroupedFields, null)}</div>
        </div>
        {draft.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex gap-2">
              <input value={section.title} onChange={(event) => { const next=structuredClone(draft); next.sections[sectionIndex].title=event.target.value; setDraft(next); }} placeholder="Section title" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-sm font-bold" />
              <button type="button" onClick={() => { const next=structuredClone(draft); next.sections.splice(sectionIndex,1); setDraft(next); }} className="text-xs font-bold text-red-500">Remove section</button>
            </div>
            <div className="space-y-2">{renderFields(section.fields, sectionIndex)}</div>
            <button type="button" onClick={() => { const next=structuredClone(draft); next.sections[sectionIndex].fields.push(newField()); setDraft(next); }} className="mt-2 text-xs font-bold text-[#5c8f32]">+ Field</button>
          </div>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, sections: [...draft.sections, { title: "", description: null, fields: [newField()] }] })} className="text-xs font-bold text-[#5c8f32]">+ Section</button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          {selected && !selected.archivedAt && (
            <>
              <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result=await publishFormAction(selected.id); setMessage(result.ok ? "Draft published." : result.message); if(result.ok) router.refresh(); })} className="h-9 rounded-lg border border-[#689f38] px-3 text-xs font-bold text-[#5c8f32]">Publish draft</button>
              <button type="button" disabled={pending} onClick={() => { if(!confirm("Archive this form? Existing checklist assignments will remain available.")) return; startTransition(async()=>{const result=await archiveFormAction(selected.id); setMessage(result.ok?"Form archived.":result.message); if(result.ok) router.refresh();}); }} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600"><Archive size={14}/>Archive</button>
            </>
          )}
          <button type="button" disabled={pending || Boolean(selected?.archivedAt)} onClick={saveDraft} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#689f38] px-4 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{pending ? "Saving…" : "Save draft"}</button>
        </div>
      </section>
    </div>
  );
}
