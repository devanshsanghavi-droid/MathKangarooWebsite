import type { ReactNode } from 'react';
import { TestAreaLayout } from '@/components/exams/test-pages';

/**
 * Every page under /sat carries the SAT trademark notice (docs/07 section 1) above the
 * footer's Math Kangaroo disclaimer, and the area's own section links under the top bar.
 */
export default function SatLayout({ children }: { children: ReactNode }) {
  return <TestAreaLayout test="SAT">{children}</TestAreaLayout>;
}
