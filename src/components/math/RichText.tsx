'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Text that may carry `$...$` math, rendered by whatever typesetter an ancestor provides.
 *
 * The shared problem components (choices, feedback, hints, solutions, the bank list) render
 * through this rather than importing KaTeX themselves, so the Kangaroo pages, which never have
 * math, never ship KaTeX's JavaScript. Pages that do have math (the AMC beta) wrap their tree in
 * <MathProvider>, which typesets on the server and the client alike.
 *
 * With no provider, or with `math` false, the text is rendered exactly as written.
 */
export type MathRenderer = (text: string) => ReactNode;

export const MathContext = createContext<MathRenderer | null>(null);

export function RichText({ text, math = false }: { text: string; math?: boolean }) {
  const render = useContext(MathContext);
  if (!math || !render) return <>{text}</>;
  return <>{render(text)}</>;
}
