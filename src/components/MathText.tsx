import katex from 'katex';
import { Fragment } from 'react';

/**
 * Text with inline KaTeX in `$...$` (and display math in `$$...$$`), as the AMC content
 * stores it (docs/06 §5). Server-safe and deterministic: KaTeX renders to a string, so the
 * server HTML and the client render are identical and nothing re-typesets after hydration.
 *
 * KaTeX's default output carries MathML alongside the visual HTML, which is what a screen
 * reader reads. A malformed formula renders as its source in the error colour KaTeX picks
 * (`throwOnError: false`) rather than taking the page down; content validation is where a
 * broken formula should be caught.
 *
 * `math={false}` renders the text untouched. Kangaroo statements are plain text and may well
 * contain a dollar sign that means dollars.
 */

export type MathSegment = { kind: 'text' | 'inline' | 'display'; value: string };

/** Split on unescaped `$` / `$$`. `\$` is a literal dollar. An unclosed `$` stays text. */
export function splitMath(text: string): MathSegment[] {
  const out: MathSegment[] = [];
  let buffer = '';
  let index = 0;
  const flushText = () => {
    if (buffer) out.push({ kind: 'text', value: buffer });
    buffer = '';
  };
  while (index < text.length) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '$') {
      buffer += '$';
      index += 2;
      continue;
    }
    if (char === '$') {
      const display = text[index + 1] === '$';
      const open = display ? '$$' : '$';
      const start = index + open.length;
      let end = start;
      while (end < text.length) {
        if (text[end] === '\\') {
          end += 2;
          continue;
        }
        if (text.startsWith(open, end)) break;
        end += 1;
      }
      if (end >= text.length) {
        // No closing delimiter: treat the rest as plain text.
        buffer += text.slice(index);
        break;
      }
      flushText();
      out.push({ kind: display ? 'display' : 'inline', value: text.slice(start, end) });
      index = end + open.length;
      continue;
    }
    buffer += char;
    index += 1;
  }
  flushText();
  return out;
}

export function renderMath(source: string, displayMode = false): string {
  return katex.renderToString(source, { displayMode, throwOnError: false, strict: 'ignore' });
}

export function MathText({ text, math = true }: { text: string; math?: boolean }) {
  if (!math || !text.includes('$')) return <>{text}</>;
  return (
    <>
      {splitMath(text).map((segment, index) =>
        segment.kind === 'text' ? (
          <Fragment key={index}>{segment.value}</Fragment>
        ) : (
          <span
            key={index}
            className={segment.kind === 'display' ? 'block overflow-x-auto py-1' : undefined}
            // Rendered by KaTeX from our own reviewed content files, never from user input.
            dangerouslySetInnerHTML={{
              __html: renderMath(segment.value, segment.kind === 'display'),
            }}
          />
        ),
      )}
    </>
  );
}
