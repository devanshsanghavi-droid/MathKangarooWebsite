import type { ComponentType } from 'react';
import { BarModelParts } from './BarModelParts';
import { BlockedGridPaths } from './BlockedGridPaths';
import { BoardMissingCorners } from './BoardMissingCorners';
import { BoardThreeByThree } from './BoardThreeByThree';
import { BooksBarChart } from './BooksBarChart';
import { CircleInSquare } from './CircleInSquare';
import { ClockThree } from './ClockThree';
import { CornerCubeStack } from './CornerCubeStack';
import { CubeNetCandidates } from './CubeNetCandidates';
import { CubeNetCross } from './CubeNetCross';
import { DotStages } from './DotStages';
import { FlagRotation } from './FlagRotation';
import { FoldPunchSquare } from './FoldPunchSquare';
import { LShapeUnits } from './LShapeUnits';
import { MenuTree } from './MenuTree';
import { NumberGridRule } from './NumberGridRule';
import { NumberLineArrow } from './NumberLineArrow';
import { PetsBarChart } from './PetsBarChart';
import { RectangleSplitInThree } from './RectangleSplitInThree';
import { RoomUnfold } from './RoomUnfold';
import { SquareWithCorner } from './SquareWithCorner';
import { SymmetryCandidates } from './SymmetryCandidates';
import { TriangleSplitInThree } from './TriangleSplitInThree';
import { TwoViewsOfSolid } from './TwoViewsOfSolid';
import { UnitCubeBlock } from './UnitCubeBlock';

/**
 * Every figure component, keyed by the name problem JSON refers to it by.
 *
 * This registry is explicit rather than a dynamic import, for three reasons: the build stays
 * static, an unknown component name is a type error rather than a runtime blank, and
 * `pnpm validate:content` can check every referenced name resolves to a file on disk.
 * `src/components/__tests__/problem-components.test.tsx` asserts every registered figure
 * renders and every figure a problem references is registered.
 */
export const FIGURES: Record<string, ComponentType> = {
  BarModelParts,
  BlockedGridPaths,
  BoardMissingCorners,
  BoardThreeByThree,
  BooksBarChart,
  CircleInSquare,
  ClockThree,
  CornerCubeStack,
  CubeNetCandidates,
  CubeNetCross,
  DotStages,
  FlagRotation,
  FoldPunchSquare,
  LShapeUnits,
  MenuTree,
  NumberGridRule,
  NumberLineArrow,
  PetsBarChart,
  RectangleSplitInThree,
  RoomUnfold,
  SquareWithCorner,
  SymmetryCandidates,
  TriangleSplitInThree,
  TwoViewsOfSolid,
  UnitCubeBlock,
};

export const FIGURE_NAMES = Object.keys(FIGURES).sort();
