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
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { uploadCardCommentImageAction } from "@/app/dashboard/boards/actions";
import {
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_TEXT_LENGTH,
  normalizeCommentDocument,
  type CommentDocument,
} from "@/app/lib/comments/content";
import type { MentionableUserDTO } from "@/app/lib/dal/users";
import {
  compressedPastedImageDataUrl,
  imageSources,
  replaceImageSources,
  validatePastedImageFile,
} from "@/app/lib/images/pasted-image";
import { createMentionSuggestion } from "./mention-suggestion";

const starterKit = StarterKit.configure({
  heading: false,
  horizontalRule: false,
  link: false,
});
const imageExtension = Image.configure({
  allowBase64: false,
  HTMLAttributes: {
    class:
      "my-2 max-h-64 max-w-full rounded-lg border border-slate-200 object-contain",
  },
});

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
      className={`grid size-7 place-items-center rounded transition disabled:cursor-not-allowed disabled:opacity-35 ${
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
  cardId,
  disabled,
  resetVersion,
  users,
  onSubmit,
}: {
  cardId: string;
  disabled: boolean;
  resetVersion: number;
  users: MentionableUserDTO[];
  onSubmit: (document: CommentDocument) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const pendingImages = useRef(new Map<string, File>());
  const extensions = useMemo(
    () => [
      starterKit,
      imageExtension,
      Mention.configure({
        HTMLAttributes: {
          class:
            "mention rounded-md bg-[#e8f3dc] px-1.5 py-0.5 font-semibold text-[#4f772d]",
        },
        suggestion: createMentionSuggestion(users),
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        renderHTML: ({ options, node }) => [
          "span",
          {
            ...options.HTMLAttributes,
            "data-type": "mention",
            "data-id": node.attrs.id,
          },
          `@${node.attrs.label ?? node.attrs.id}`,
        ],
      }),
    ],
    [users],
  );
  const editor = useEditor({
    extensions,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap thin-scrollbar min-h-32 max-h-52 overflow-y-auto px-3 pb-14 pt-2.5 text-sm outline-none",
        "aria-label": "Comment",
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
            imageSources(view.state.doc.toJSON()).length >= MAX_COMMENT_IMAGES
          ) {
            throw new Error(
              `A comment can contain up to ${MAX_COMMENT_IMAGES} images.`,
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

  useEffect(() => {
    const images = pendingImages.current;
    return () => {
      images.forEach((_, previewUrl) => URL.revokeObjectURL(previewUrl));
      images.clear();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

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
      if (sources.length > MAX_COMMENT_IMAGES) {
        throw new Error(
          `A comment can contain up to ${MAX_COMMENT_IMAGES} images.`,
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
        const result = await uploadCardCommentImageAction({
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

      const document = normalizeCommentDocument(nextDocument);
      if (!document) throw new Error("Write a comment before submitting.");
      await onSubmit(document);
    } catch (error: unknown) {
      setImageError(
        error instanceof Error
          ? error.message
          : "The comment could not be sent.",
      );
    } finally {
      setSaving(false);
    }
  }

  const unavailable = disabled || saving || !editor;

  return (
    <form onSubmit={submit}>
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-[#689f38] focus-within:ring-3 focus-within:ring-[#8bc34a]/20">
        <div
          className="flex flex-wrap items-center gap-px border-b border-slate-200 bg-slate-50 p-0.5"
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
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
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
          <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
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
          <button
            type="submit"
            aria-label="Add comment"
            title="Add comment"
            disabled={
              unavailable ||
              state?.empty ||
              (state?.characters || 0) > MAX_COMMENT_TEXT_LENGTH
            }
            className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-lg bg-[#64dd17] text-white shadow-md transition hover:bg-[#58c714] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {saving && pendingImageCount > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Uploading images and sending…
        </p>
      )}
      {imageError && (
        <p className="mt-1 text-xs font-medium text-red-600">{imageError}</p>
      )}
      {!saving && pendingImageCount > 0 && !imageError && (
        <p className="mt-1 text-xs text-slate-500">
          {pendingImageCount} pasted image
          {pendingImageCount === 1 ? "" : "s"} will upload when sent.
        </p>
      )}

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
          <div className="flex gap-px rounded-lg border border-slate-200 bg-white p-0.5 shadow-xl">
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

    </form>
  );
}
