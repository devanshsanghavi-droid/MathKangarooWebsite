'use client';

import type { ReactNode } from 'react';
import { MathText } from '../MathText';
import { MathContext, type MathRenderer } from './RichText';

const renderMath: MathRenderer = (text) => <MathText text={text} />;

/**
 * Turns on KaTeX for every <RichText math> below it. Wrap the AMC beta's pages (or a practice
 * set of AMC items) in this; the Kangaroo pages leave it out and so never load KaTeX.
 */
export function MathProvider({ children }: { children: ReactNode }) {
  return <MathContext.Provider value={renderMath}>{children}</MathContext.Provider>;
}
