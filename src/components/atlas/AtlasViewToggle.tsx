'use client';

import type { AtlasView } from '@/lib/atlas-params';
import { SegmentedControl } from '@/components/ui';

/**
 * Graph or list. Rendered before the Atlas region so that a reader arriving by keyboard or with
 * a screen reader meets the choice before the diagram, not after it.
 *
 * The two views are equals, not a main view and a fallback: they show the same skills, and the
 * list is often the faster way in even with a mouse.
 */
export function AtlasViewToggle({
  view,
  onChange,
}: {
  view: AtlasView;
  onChange: (view: AtlasView) => void;
}) {
  return (
    <SegmentedControl
      label="Atlas view"
      value={view}
      onChange={onChange}
      options={[
        { value: 'graph', label: 'Graph' },
        { value: 'list', label: 'List' },
      ]}
    />
  );
}
