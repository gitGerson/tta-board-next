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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { uploadCardDescriptionImageAction } from "@/app/dashboard/boards/actions";
import {
  MAX_RICH_TEXT_IMAGES,
  MAX_RICH_TEXT_LENGTH,
  normalizeRichTextDocument,
  type RichTextDocument,
} from "@/app/lib/rich-text/content";
import {
  compressedPastedImageDataUrl,
  imageSources,
  replaceImageSources,
  validatePastedImageFile,
} from "@/app/lib/images/pasted-image";

const starterKit = StarterKit.configure({
  heading: { levels: [2, 3] },
  horizontalRule: false,
  link: false,
});
const imageExtension = Image.configure({
  allowBase64: false,
  HTMLAttributes: {
    class:
      "my-2 max-h-80 max-w-full rounded-lg border border-slate-200 object-contain",
  },
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
  cardId,
  initialDocument,
  disabled,
  onCancel,
  onSave,
}: {
  cardId: string;
  initialDocument: RichTextDocument | null;
  disabled: boolean;
  onCancel: () => void;
  onSave: (document: RichTextDocument | null) => Promise<boolean>;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const pendingImages = useRef(new Map<string, File>());
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
        try {
          validatePastedImageFile(imageFile);
          if (
            imageSources(view.state.doc.toJSON()).length >=
            MAX_RICH_TEXT_IMAGES
          ) {
            throw new Error(
              `A description can contain up to ${MAX_RICH_TEXT_IMAGES} images.`,
            );
          }

          const previewUrl = URL.createObjectURL(imageFile);
          const imageNode = view.state.schema.nodes.image?.create({
            src: previewUrl,
            alt: imageFile.name || "Pasted image",
            title: null,
          });
          if (!imageNode) {
            URL.revokeObjectURL(previewUrl);
            return true;
          }
          pendingImages.current.set(previewUrl, imageFile);
          setPendingImageCount(pendingImages.current.size);
          view.dispatch(
            view.state.tr.replaceSelectionWith(imageNode).scrollIntoView(),
          );
        } catch (error: unknown) {
          setImageError(
            error instanceof Error
              ? error.message
              : "The image could not be pasted.",
          );
        }

        return true;
      },
    },
  });
  useEffect(() => {
    const images = pendingImages.current;
    return () => {
      images.forEach((_, previewUrl) => URL.revokeObjectURL(previewUrl));
      images.clear();
    };
  }, []);
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
  const unavailable = disabled || saving || !editor;
  const tooLong = (state?.characters || 0) > MAX_RICH_TEXT_LENGTH;

  async function save() {
    if (!editor || tooLong) return;

    setImageError(null);
    setSaving(true);
    let nextDocument = editor.getJSON();
    const presentSources = new Set(imageSources(nextDocument));

    for (const [previewUrl] of pendingImages.current) {
      if (!presentSources.has(previewUrl)) {
        URL.revokeObjectURL(previewUrl);
        pendingImages.current.delete(previewUrl);
      }
    }
    setPendingImageCount(pendingImages.current.size);

    try {
      const sources = imageSources(nextDocument);
      if (sources.length > MAX_RICH_TEXT_IMAGES) {
        throw new Error(
          `A description can contain up to ${MAX_RICH_TEXT_IMAGES} images.`,
        );
      }
      if (
        sources.some(
          (source) =>
            source.startsWith("blob:") && !pendingImages.current.has(source),
        )
      ) {
        throw new Error("One pasted image is no longer available.");
      }

      for (const [previewUrl, file] of pendingImages.current) {
        const dataUrl = await compressedPastedImageDataUrl(file);
        const result = await uploadCardDescriptionImageAction({
          cardId,
          dataUrl,
        });
        if (!result.ok) throw new Error(result.message);

        nextDocument = replaceImageSources(
          nextDocument,
          new Map([[previewUrl, result.url]]),
        );
        editor.commands.setContent(nextDocument);
        URL.revokeObjectURL(previewUrl);
        pendingImages.current.delete(previewUrl);
        setPendingImageCount(pendingImages.current.size);
      }

      const document = normalizeRichTextDocument(nextDocument);
      if (
        !document &&
        (editor.getText().trim() || imageSources(nextDocument).length > 0)
      ) {
        throw new Error("The description contains unsupported content.");
      }
      await onSave(document);
    } catch (error: unknown) {
      setImageError(
        error instanceof Error
          ? error.message
          : "The description could not be saved.",
      );
    } finally {
      setSaving(false);
    }
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
      {pendingImageCount > 0 && !imageError && (
        <p className="mt-1 text-[11px] text-slate-500">
          {pendingImageCount} pasted image
          {pendingImageCount === 1 ? "" : "s"} will upload when saved.
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
            disabled={disabled || saving}
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
            aria-label={saving ? "Saving description" : "Save description"}
            title={saving ? "Uploading and saving…" : "Save"}
          >
            <Check size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
