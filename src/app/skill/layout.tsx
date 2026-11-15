import { RailLayout } from '@/components/shell/RailLayout';

/** This section draws the skill rail beside its pages; see components/shell/RailLayout.tsx. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RailLayout>{children}</RailLayout>;
}
