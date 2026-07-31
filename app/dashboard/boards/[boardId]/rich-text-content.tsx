/* eslint-disable @next/next/no-img-element -- validated pasted data URLs have no stable intrinsic dimensions */

import { Fragment, type ReactNode } from "react";
import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from "@/app/lib/rich-text/content";

function applyMarks(content: ReactNode, marks: RichTextMark[] = []): ReactNode {
  return marks.reduce<ReactNode>((result, mark, index) => {
    const key = `${mark.type}-${index}`;

    switch (mark.type) {
      case "bold":
        return <strong key={key}>{result}</strong>;
      case "italic":
        return <em key={key}>{result}</em>;
      case "underline":
        return <u key={key}>{result}</u>;
      case "strike":
        return <s key={key}>{result}</s>;
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]"
          >
            {result}
          </code>
        );
    }
  }, content);
}

function renderChildren(node: RichTextNode): ReactNode {
  return node.content?.map((child, index) => (
    <Fragment key={`${child.type}-${index}`}>{renderNode(child)}</Fragment>
  ));
}

function renderNode(node: RichTextNode): ReactNode {
  switch (node.type) {
    case "text":
      return applyMarks(node.text || "", node.marks);
    case "hardBreak":
      return <br />;
    case "paragraph":
      return <p className="min-h-5">{renderChildren(node)}</p>;
    case "heading":
      return node.attrs?.level === 2 ? (
        <h4 className="text-base font-bold text-slate-900">
          {renderChildren(node)}
        </h4>
      ) : (
        <h5 className="text-sm font-bold text-slate-800">
          {renderChildren(node)}
        </h5>
      );
    case "bulletList":
      return <ul className="list-disc space-y-1 pl-5">{renderChildren(node)}</ul>;
    case "orderedList":
      return (
        <ol className="list-decimal space-y-1 pl-5">{renderChildren(node)}</ol>
      );
    case "listItem":
      return <li>{renderChildren(node)}</li>;
    case "blockquote":
      return (
        <blockquote className="border-l-3 border-[#a8c98b] pl-3 text-slate-600">
          {renderChildren(node)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
          <code>{renderChildren(node)}</code>
        </pre>
      );
    case "image":
      return (
        <img
          src={node.attrs?.src}
          alt={node.attrs?.alt || ""}
          className="max-h-96 max-w-full rounded-lg border border-slate-200 object-contain"
        />
      );
  }
}

export function RichTextContent({
  document,
}: {
  document: RichTextDocument;
}) {
  return (
    <div className="mt-2 space-y-2 break-words text-sm text-slate-700">
      {document.content?.map((node, index) => (
        <Fragment key={`${node.type}-${index}`}>{renderNode(node)}</Fragment>
      ))}
    </div>
  );
}
