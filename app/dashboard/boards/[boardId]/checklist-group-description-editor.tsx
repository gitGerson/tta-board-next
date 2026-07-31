"use client";

import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Underline,
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ReactNode } from "react";
import {
  MAX_RICH_TEXT_LENGTH,
  normalizeRichTextDocument,
  type RichTextDocument,
} from "@/app/lib/rich-text/content";

const starterKit = StarterKit.configure({
  heading: false,
  horizontalRule: false,
  link: false,
});

function ToolButton({
  label,
  active = false,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-6 place-items-center rounded disabled:opacity-35 ${
        active
          ? "bg-[#dbecc8] text-[#4f772d]"
          : "text-slate-500 hover:bg-white hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function ChecklistGroupDescriptionEditor({
  initialDocument,
  disabled,
  onChange,
}: {
  initialDocument: RichTextDocument | null;
  disabled: boolean;
  onChange: (document: RichTextDocument | null) => void;
}) {
  const editor = useEditor({
    extensions: [starterKit],
    content: initialDocument ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      onChange(normalizeRichTextDocument(current.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          "tiptap thin-scrollbar min-h-14 max-h-28 overflow-y-auto px-2.5 py-2 text-xs outline-none",
        "aria-label": "Checklist group description",
      },
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;

      return {
        empty: current.isEmpty,
        characters: current.getText().length,
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        blockquote: current.isActive("blockquote"),
      };
    },
  });
  const unavailable = disabled || !editor;
  const tooLong = (state?.characters || 0) > MAX_RICH_TEXT_LENGTH;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white ${
        tooLong
          ? "border-red-400"
          : "border-slate-300 focus-within:border-[#689f38] focus-within:ring-2 focus-within:ring-[#8bc34a]/20"
      }`}
    >
      <div
        className="flex items-center gap-px border-b border-slate-200 bg-slate-50 p-0.5"
        role="toolbar"
        aria-label="Group description formatting"
      >
        <ToolButton
          label="Bold"
          active={state?.bold}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold size={12} />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={state?.italic}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic size={12} />
        </ToolButton>
        <ToolButton
          label="Underline"
          active={state?.underline}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline size={12} />
        </ToolButton>
        <span className="mx-0.5 h-3.5 w-px bg-slate-200" aria-hidden="true" />
        <ToolButton
          label="Bullet list"
          active={state?.bulletList}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List size={12} />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={state?.orderedList}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={12} />
        </ToolButton>
        <ToolButton
          label="Blockquote"
          active={state?.blockquote}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={12} />
        </ToolButton>
        <span
          className={`ml-auto pr-1 text-[9px] ${
            tooLong ? "font-bold text-red-600" : "text-slate-400"
          }`}
        >
          {state?.characters || 0}/{MAX_RICH_TEXT_LENGTH}
        </span>
      </div>
      <div className="relative">
        {state?.empty && (
          <span className="pointer-events-none absolute left-2.5 top-2 text-xs text-slate-400">
            Description (optional)
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
