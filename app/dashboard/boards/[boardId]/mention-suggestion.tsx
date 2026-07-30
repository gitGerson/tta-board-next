"use client";

import { ReactRenderer } from "@tiptap/react";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import type { MentionableUserDTO } from "@/app/lib/dal/users";

export type MentionSelection = MentionNodeAttrs;

type MentionListProps = Pick<
  SuggestionProps<MentionableUserDTO, MentionSelection>,
  "items" | "command"
>;

export type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const activeIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));

    function select(index: number): void {
      const user = items[index];
      if (user) command({ id: user.id, label: user.name });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) {
          return ["ArrowUp", "ArrowDown", "Enter"].includes(event.key);
        }

        if (event.key === "ArrowUp") {
          setSelectedIndex((index) => (index + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          select(activeIndex);
          return true;
        }

        return false;
      },
    }));

    return (
      <div className="max-h-64 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-500">
            No users found.
          </p>
        ) : (
          items.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(index)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                index === activeIndex
                  ? "bg-[#edf6e5] text-[#4f772d]"
                  : "hover:bg-slate-50"
              }`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dbecc8] text-xs font-extrabold uppercase text-[#4f772d]">
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  @{user.username}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    );
  },
);

export function createMentionSuggestion(
  users: MentionableUserDTO[],
): Omit<
  SuggestionOptions<MentionableUserDTO, MentionSelection>,
  "editor"
> {
  return {
    char: "@",
    container:
      (document.querySelector("dialog[open]") as HTMLElement | null) ??
      document.body,
    items: ({ query }) => {
      const term = query.trim().toLowerCase();

      return users
        .filter((user) =>
          [user.name, user.username].some((value) =>
            value.toLowerCase().includes(term),
          ),
        )
        .slice(0, 10);
    },
    command: ({ editor, range, props }) => {
      if (!props.id) return;

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: { id: props.id, label: props.label ?? props.id },
          },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer<
        MentionListHandle,
        MentionListProps
      > | null = null;
      let unmount: (() => void) | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            editor: props.editor,
            props: { items: props.items, command: props.command },
          });
          unmount = props.mount(component.element);
        },
        onUpdate: (props) => {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            exitSuggestion(props.view);
            return true;
          }

          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          unmount?.();
          component?.destroy();
          unmount = null;
          component = null;
        },
      };
    },
  };
}
