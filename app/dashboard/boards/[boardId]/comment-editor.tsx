"use client";

import {
  Bold,
  Code2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, type FormEvent, type ReactNode } from "react";
import {
  MAX_COMMENT_TEXT_LENGTH,
  normalizeCommentDocument,
  type CommentDocument,
} from "@/app/lib/comments/content";

const extensions = [
  StarterKit.configure({
    heading: false,
    horizontalRule: false,
    link: false,
  }),
];

function MenuButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
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
      className={`grid size-8 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-[#dbecc8] text-[#4f772d]"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function CommentEditor({
  disabled,
  resetVersion,
  onSubmit,
}: {
  disabled: boolean;
  resetVersion: number;
  onSubmit: (document: CommentDocument) => void;
}) {
  const editor = useEditor({
    extensions,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-24 max-h-52 overflow-y-auto px-3 py-2.5 text-sm outline-none",
        "aria-label": "Comment",
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
        strike: current.isActive("strike"),
        code: current.isActive("code"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        blockquote: current.isActive("blockquote"),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });

  useEffect(() => {
    if (resetVersion > 0) {
      editor?.commands.clearContent();
    }
  }, [editor, resetVersion]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    const document = normalizeCommentDocument(editor.getJSON());
    if (document) onSubmit(document);
  }

  const unavailable = disabled || !editor;

  return (
    <form onSubmit={submit}>
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-[#689f38] focus-within:ring-3 focus-within:ring-[#8bc34a]/20">
        <div
          className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1"
          role="toolbar"
          aria-label="Comment formatting"
        >
          <MenuButton
            label="Bold"
            active={state?.bold}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={15} />
          </MenuButton>
          <MenuButton
            label="Italic"
            active={state?.italic}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={15} />
          </MenuButton>
          <MenuButton
            label="Underline"
            active={state?.underline}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Underline size={15} />
          </MenuButton>
          <MenuButton
            label="Strikethrough"
            active={state?.strike}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={15} />
          </MenuButton>
          <MenuButton
            label="Inline code"
            active={state?.code}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <Code2 size={15} />
          </MenuButton>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          <MenuButton
            label="Bullet list"
            active={state?.bulletList}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={15} />
          </MenuButton>
          <MenuButton
            label="Numbered list"
            active={state?.orderedList}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} />
          </MenuButton>
          <MenuButton
            label="Blockquote"
            active={state?.blockquote}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={15} />
          </MenuButton>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          <MenuButton
            label="Undo"
            disabled={unavailable || !state?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={15} />
          </MenuButton>
          <MenuButton
            label="Redo"
            disabled={unavailable || !state?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={15} />
          </MenuButton>
        </div>

        <div className="relative">
          {state?.empty && (
            <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-400">
              Write a comment…
            </span>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      <p
        className={`mt-1 text-right text-[11px] ${
          (state?.characters || 0) > MAX_COMMENT_TEXT_LENGTH
            ? "font-bold text-red-600"
            : "text-slate-400"
        }`}
      >
        {state?.characters || 0}/{MAX_COMMENT_TEXT_LENGTH}
      </p>

      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
        >
          <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
            <MenuButton
              label="Bold"
              active={state?.bold}
              disabled={unavailable}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={15} />
            </MenuButton>
            <MenuButton
              label="Italic"
              active={state?.italic}
              disabled={unavailable}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={15} />
            </MenuButton>
            <MenuButton
              label="Underline"
              active={state?.underline}
              disabled={unavailable}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline size={15} />
            </MenuButton>
          </div>
        </BubbleMenu>
      )}

      <button
        type="submit"
        disabled={
          unavailable ||
          state?.empty ||
          (state?.characters || 0) > MAX_COMMENT_TEXT_LENGTH
        }
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        <Send size={15} aria-hidden="true" />
        Add comment
      </button>
    </form>
  );
}
