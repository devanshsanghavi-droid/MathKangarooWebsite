import type { ReactNode } from 'react';
import { TestAreaLayout } from '@/components/exams/test-pages';

/**
 * Every page under /act carries the ACT trademark notice (docs/07 section 1) above the
 * footer's Math Kangaroo disclaimer, and the area's own section links under the top bar.
 */
export default function ActLayout({ children }: { children: ReactNode }) {
  return <TestAreaLayout test="ACT">{children}</TestAreaLayout>;
}
