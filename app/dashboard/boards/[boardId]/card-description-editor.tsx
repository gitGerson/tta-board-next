"use client";

import {
  Bold,
  Check,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { useState, type ReactNode } from "react";
import {
  MAX_INLINE_IMAGE_DATA_URL_LENGTH,
  MAX_RICH_TEXT_LENGTH,
  normalizeRichTextDocument,
  type RichTextDocument,
} from "@/app/lib/rich-text/content";

const starterKit = StarterKit.configure({
  heading: { levels: [2, 3] },
  horizontalRule: false,
  link: false,
});
const imageExtension = Image.configure({
  allowBase64: true,
  HTMLAttributes: {
    class:
      "my-2 max-h-80 max-w-full rounded-lg border border-slate-200 object-contain",
  },
});
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

async function pastedImageDataUrl(file: File): Promise<string> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Paste a PNG, JPEG, or WebP image.");
  }
  if (file.size > 10_000_000) {
    throw new Error("The pasted image must be smaller than 10 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1_200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("The image could not be processed.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/webp", quality);
  while (dataUrl.length > MAX_INLINE_IMAGE_DATA_URL_LENGTH && quality > 0.42) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/webp", quality);
  }

  if (dataUrl.length > MAX_INLINE_IMAGE_DATA_URL_LENGTH) {
    throw new Error("The image is still too large after compression.");
  }

  return dataUrl;
}

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
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid size-7 place-items-center rounded disabled:opacity-35 ${
        active
          ? "bg-[#dbecc8] text-[#4f772d]"
          : "text-slate-500 hover:bg-white hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function CardDescriptionEditor({
  initialDocument,
  disabled,
  onCancel,
  onSave,
}: {
  initialDocument: RichTextDocument | null;
  disabled: boolean;
  onCancel: () => void;
  onSave: (document: RichTextDocument | null) => void;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [starterKit, imageExtension],
    content: initialDocument ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap thin-scrollbar min-h-24 max-h-44 overflow-y-auto px-3 py-2 text-sm outline-none",
        "aria-label": "Card description",
      },
      handlePaste(view, event) {
        const imageFile = Array.from(event.clipboardData?.files || []).find(
          (file) => file.type.startsWith("image/"),
        );
        if (!imageFile) return false;

        event.preventDefault();
        setImageError(null);
        void pastedImageDataUrl(imageFile)
          .then((src) => {
            if (!view.dom.isConnected) return;
            const imageNode = view.state.schema.nodes.image?.create({
              src,
              alt: imageFile.name || "Pasted image",
              title: null,
            });
            if (!imageNode) return;
            view.dispatch(
              view.state.tr.replaceSelectionWith(imageNode).scrollIntoView(),
            );
          })
          .catch((error: unknown) => {
            setImageError(
              error instanceof Error
                ? error.message
                : "The image could not be pasted.",
            );
          });

        return true;
      },
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;

      return {
        characters: current.getText().length,
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        heading2: current.isActive("heading", { level: 2 }),
        heading3: current.isActive("heading", { level: 3 }),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        blockquote: current.isActive("blockquote"),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });
  const unavailable = disabled || !editor;
  const tooLong = (state?.characters || 0) > MAX_RICH_TEXT_LENGTH;

  function save() {
    if (!editor || tooLong) return;
    onSave(normalizeRichTextDocument(editor.getJSON()));
  }

  return (
    <div className="mt-2">
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-[#689f38] focus-within:ring-2 focus-within:ring-[#8bc34a]/20">
        <div
          className="flex flex-wrap items-center gap-px border-b border-slate-200 bg-slate-50 p-0.5"
          role="toolbar"
          aria-label="Description formatting"
        >
          <ToolButton
            label="Bold"
            active={state?.bold}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={13} />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={state?.italic}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={13} />
          </ToolButton>
          <ToolButton
            label="Underline"
            active={state?.underline}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Underline size={13} />
          </ToolButton>
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
          <ToolButton
            label="Heading 2"
            active={state?.heading2}
            disabled={unavailable}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 size={13} />
          </ToolButton>
          <ToolButton
            label="Heading 3"
            active={state?.heading3}
            disabled={unavailable}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 size={13} />
          </ToolButton>
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
          <ToolButton
            label="Bullet list"
            active={state?.bulletList}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={13} />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={state?.orderedList}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={13} />
          </ToolButton>
          <ToolButton
            label="Blockquote"
            active={state?.blockquote}
            disabled={unavailable}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={13} />
          </ToolButton>
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
          <ToolButton
            label="Undo"
            disabled={unavailable || !state?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={13} />
          </ToolButton>
          <ToolButton
            label="Redo"
            disabled={unavailable || !state?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={13} />
          </ToolButton>
        </div>
        <EditorContent editor={editor} />
      </div>
      {imageError && (
        <p className="mt-1 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
          {imageError}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <span
          className={`text-[10px] ${
            tooLong ? "font-bold text-red-600" : "text-slate-400"
          }`}
        >
          {state?.characters || 0}/{MAX_RICH_TEXT_LENGTH}
        </span>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="grid size-8 place-items-center text-slate-500 hover:bg-slate-50 disabled:opacity-60"
            aria-label="Cancel editing description"
            title="Cancel"
          >
            <X size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={save}
            disabled={unavailable || tooLong}
            className="grid size-8 place-items-center border-l border-[#5c8f32] bg-[#689f38] text-white hover:bg-[#557f2f] disabled:opacity-50"
            aria-label={disabled ? "Saving description" : "Save description"}
            title={disabled ? "Saving…" : "Save"}
          >
            <Check size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
