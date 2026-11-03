import { STRANDS, TIERS, type Skill, type Strand, type Tier } from './schemas';

/**
 * The Atlas layout.
 *
 * A pure function: same skills in, byte-identical coordinates out. That matters because the
 * SVG is server-rendered into every build - a layout that drifted between builds would make
 * every deploy a diff, and would move a node under a reader's cursor for no reason.
 *
 * The rules, in priority order:
 *
 *   1. **Column by strand.** Seven columns in the canonical strand order. Column widths are
 *      computed from content, so a crowded strand gets more room than a sparse one.
 *   2. **Row by layer, and an edge always points downward.** A skill's layer is
 *      `max(tier floor, 1 + the deepest prerequisite's layer)`. The tier floor keeps
 *      foundation at row 0 or below, core at row 1 or below, gateway at row 2 or below, so the
 *      three tiers read as bands; the prerequisite term guarantees that no arrow ever points
 *      up. Where the two disagree the prerequisite wins, because that is a hard constraint and
 *      the tier is a description.
 *   3. **Ties break on id.** Two skills in the same cell are placed left to right by id, which
 *      is permanent, so the layout is stable as the taxonomy grows.
 *
 * Cross-strand edges are unavoidable - GEO-16 really does need NUM-11 - and are returned
 * flagged so the graph can draw them more faintly than the within-strand ones.
 */

export interface AtlasNode {
  id: string;
  name: string;
  strand: Strand;
  tier: Tier;
  /** Row index. 0 is the top. */
  layer: number;
  x: number;
  y: number;
  problemCount: number;
}

export interface AtlasEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  crossStrand: boolean;
}

export interface AtlasColumn {
  strand: Strand;
  x: number;
  width: number;
}

export interface AtlasLayout {
  nodes: readonly AtlasNode[];
  edges: readonly AtlasEdge[];
  columns: readonly AtlasColumn[];
  width: number;
  height: number;
  layerCount: number;
  /** Y coordinate of the centre of each row, for the tier band labels. */
  layerY: readonly number[];
}

export const LAYOUT_CONSTANTS = {
  nodeRadius: 9,
  /** Horizontal space one node occupies inside its column. */
  slotWidth: 46,
  rowHeight: 78,
  columnGap: 34,
  paddingX: 28,
  paddingY: 46,
  minColumnWidth: 92,
} as const;

const TIER_FLOOR: Record<Tier, number> = { foundation: 0, core: 1, gateway: 2 };

/**
 * Assign each skill a row. Relaxes in dependency order, so a skill is only placed once every
 * prerequisite it has inside the visible set has been placed.
 *
 * A prerequisite that has been filtered out of view does not hold its dependant up - otherwise
 * filtering to one strand would push every cross-strand dependant off the bottom of the page.
 */
export function computeLayers(skills: readonly Skill[]): Map<string, number> {
  const visible = new Set(skills.map((skill) => skill.id));
  const layer = new Map<string, number>();
  const pending = new Set(skills.map((skill) => skill.id));
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  let progressed = true;
  while (pending.size > 0 && progressed) {
    progressed = false;
    for (const id of [...pending].sort()) {
      const skill = byId.get(id);
      if (!skill) {
        pending.delete(id);
        continue;
      }
      const relevant = skill.prerequisites.filter((prereq) => visible.has(prereq));
      if (!relevant.every((prereq) => layer.has(prereq))) continue;

      const fromPrereqs = relevant.length
        ? Math.max(...relevant.map((prereq) => layer.get(prereq) ?? 0)) + 1
        : 0;
      layer.set(id, Math.max(TIER_FLOOR[skill.tier], fromPrereqs));
      pending.delete(id);
      progressed = true;
    }
  }

  // Only reachable if the graph has a cycle, which CI forbids. Place survivors on their tier
  // floor rather than dropping them, so the Atlas still shows every skill it was given.
  for (const id of pending) {
    const skill = byId.get(id);
    layer.set(id, skill ? TIER_FLOOR[skill.tier] : 0);
  }
  return layer;
}

export function layoutAtlas(
  skills: readonly Skill[],
  problemCounts: ReadonlyMap<string, number> = new Map(),
): AtlasLayout {
  const { nodeRadius, slotWidth, rowHeight, columnGap, paddingX, paddingY, minColumnWidth } =
    LAYOUT_CONSTANTS;

  if (skills.length === 0) {
    return { nodes: [], edges: [], columns: [], width: 0, height: 0, layerCount: 0, layerY: [] };
  }

  const layer = computeLayers(skills);
  const layerCount = Math.max(...skills.map((skill) => layer.get(skill.id) ?? 0)) + 1;

  // Group into (strand, layer) cells, each sorted by id.
  const cells = new Map<string, Skill[]>();
  const cellKey = (strand: Strand, row: number) => `${strand}:${row}`;
  for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = cellKey(skill.strand, layer.get(skill.id) ?? 0);
    const bucket = cells.get(key);
    if (bucket) bucket.push(skill);
    else cells.set(key, [skill]);
  }

  // A column is as wide as its busiest row.
  const presentStrands = STRANDS.filter((strand) =>
    skills.some((skill) => skill.strand === strand),
  );
  const columns: AtlasColumn[] = [];
  let cursor = paddingX;
  for (const strand of presentStrands) {
    let busiest = 1;
    for (let row = 0; row < layerCount; row += 1) {
      busiest = Math.max(busiest, cells.get(cellKey(strand, row))?.length ?? 0);
    }
    const width = Math.max(minColumnWidth, busiest * slotWidth);
    columns.push({ strand, x: cursor, width });
    cursor += width + columnGap;
  }
  const width = cursor - columnGap + paddingX;
  const height = paddingY * 2 + (layerCount - 1) * rowHeight;
  const layerY = Array.from({ length: layerCount }, (_, row) => paddingY + row * rowHeight);

  const columnByStrand = new Map(columns.map((column) => [column.strand, column]));
  const nodes: AtlasNode[] = [];

  for (const [key, group] of [...cells.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [strandPart, rowPart] = key.split(':');
    const strand = strandPart as Strand;
    const row = Number(rowPart);
    const column = columnByStrand.get(strand);
    if (!column) continue;
    const centre = column.x + column.width / 2;

    group.forEach((skill, index) => {
      const offset = (index - (group.length - 1) / 2) * slotWidth;
      nodes.push({
        id: skill.id,
        name: skill.name,
        strand: skill.strand,
        tier: skill.tier,
        layer: row,
        x: Number((centre + offset).toFixed(2)),
        y: layerY[row] ?? paddingY,
        problemCount: problemCounts.get(skill.id) ?? 0,
      });
    });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edges: AtlasEdge[] = [];
  for (const skill of [...skills].sort((a, b) => a.id.localeCompare(b.id))) {
    const to = nodeById.get(skill.id);
    if (!to) continue;
    for (const prereqId of [...skill.prerequisites].sort()) {
      const from = nodeById.get(prereqId);
      if (!from) continue; // filtered out of view
      edges.push({
        from: prereqId,
        to: skill.id,
        x1: from.x,
        y1: from.y + nodeRadius,
        x2: to.x,
        y2: to.y - nodeRadius,
        crossStrand: from.strand !== to.strand,
      });
    }
  }

  return { nodes, edges, columns, width, height, layerCount, layerY };
}

/** Tier bands, for the row labels down the side of the graph. */
export function tierBands(layout: AtlasLayout): Array<{ tier: Tier; from: number; to: number }> {
  const bands: Array<{ tier: Tier; from: number; to: number }> = [];
  for (const tier of TIERS) {
    const rows = layout.nodes.filter((node) => node.tier === tier).map((node) => node.layer);
    if (rows.length === 0) continue;
    bands.push({ tier, from: Math.min(...rows), to: Math.max(...rows) });
  }
  return bands;
}
