"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

export function Modal({
  title,
  description,
  children,
  headerLeading,
  headerActions,
  visuallyHideHeading = false,
  onClose,
  size = "md",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  headerLeading?: ReactNode;
  headerActions?: ReactNode;
  visuallyHideHeading?: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement as HTMLElement | null;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => returnFocus?.focus();
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  const maxWidth = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    "2xl": "max-w-6xl",
    // Fills the dialog, which already leaves a 1rem gutter on each side.
    full: "max-w-none",
  }[size];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={handleBackdrop}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-none overflow-y-auto rounded-2xl bg-transparent p-0 text-left backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
    >
      <section
        className={`mx-auto w-full ${maxWidth} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-2.5 sm:px-6">
          {headerLeading && <div className="shrink-0">{headerLeading}</div>}
          <div className={visuallyHideHeading ? "sr-only" : "min-w-0 flex-1"}>
            <h2
              id={titleId}
              className={visuallyHideHeading ? undefined : "text-base font-bold text-slate-900"}
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {headerActions}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className={`grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-[#689f38] ${
              visuallyHideHeading && !headerActions ? "ml-auto" : ""
            }`}
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}
