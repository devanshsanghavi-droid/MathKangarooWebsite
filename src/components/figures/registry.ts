import type { ComponentType } from 'react';
import { AppleSalesPictogram } from './AppleSalesPictogram';
import { BarModelParts } from './BarModelParts';
import { BlockedGridPaths } from './BlockedGridPaths';
import { BlockStairStages } from './BlockStairStages';
import { BoardMissingCorners } from './BoardMissingCorners';
import { BoardThreeByThree } from './BoardThreeByThree';
import { BooksBarChart } from './BooksBarChart';
import { CircleInSquare } from './CircleInSquare';
import { ClockThree } from './ClockThree';
import { CocoaCupsChart } from './CocoaCupsChart';
import { CornerCubeStack } from './CornerCubeStack';
import { CubeNetCandidates } from './CubeNetCandidates';
import { CubeNetCross } from './CubeNetCross';
import { CubeNetStaircase } from './CubeNetStaircase';
import { CubeNetStepsNumbered } from './CubeNetStepsNumbered';
import { CubeNetTwoRows } from './CubeNetTwoRows';
import { CubeNetZigzag } from './CubeNetZigzag';
import { CubePlanFront } from './CubePlanFront';
import { DotStages } from './DotStages';
import { FlagRotation } from './FlagRotation';
import { FoldPunchSquare } from './FoldPunchSquare';
import { GridTwoDiagonals } from './GridTwoDiagonals';
import { HeptagramSharp } from './HeptagramSharp';
import { LibraryBarChart } from './LibraryBarChart';
import { LShapeUnits } from './LShapeUnits';
import { MenuTree } from './MenuTree';
import { MuseumVisitorsChart } from './MuseumVisitorsChart';
import { NumberGridRule } from './NumberGridRule';
import { NumberLineArrow } from './NumberLineArrow';
import { PathsHomeParkSchool } from './PathsHomeParkSchool';
import { PetsBarChart } from './PetsBarChart';
import { PlusStages } from './PlusStages';
import { PyramidRowStages } from './PyramidRowStages';
import { RainyDaysChart } from './RainyDaysChart';
import { RectangleSplitInThree } from './RectangleSplitInThree';
import { RideDistanceGraph } from './RideDistanceGraph';
import { RoomUnfold } from './RoomUnfold';
import { SquareWithCorner } from './SquareWithCorner';
import { StaircaseSquares } from './StaircaseSquares';
import { SymmetryCandidates } from './SymmetryCandidates';
import { SymmetryGridDashed } from './SymmetryGridDashed';
import { TeeTileStages } from './TeeTileStages';
import { TileFrameStages } from './TileFrameStages';
import { TiltedSquareGrid } from './TiltedSquareGrid';
import { TravelPieChart } from './TravelPieChart';
import { TriangleFanCrossed } from './TriangleFanCrossed';
import { TriangleSplitInThree } from './TriangleSplitInThree';
import { TriangleTwoIsosceles } from './TriangleTwoIsosceles';
import { TwoViewsOfSolid } from './TwoViewsOfSolid';
import { UnitCubeBlock } from './UnitCubeBlock';
import { ViewsFrontAndRight } from './ViewsFrontAndRight';
import { WaterTankGraph } from './WaterTankGraph';

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
  AppleSalesPictogram,
  BarModelParts,
  BlockedGridPaths,
  BlockStairStages,
  BoardMissingCorners,
  BoardThreeByThree,
  BooksBarChart,
  CircleInSquare,
  ClockThree,
  CocoaCupsChart,
  CornerCubeStack,
  CubeNetCandidates,
  CubeNetCross,
  CubeNetStaircase,
  CubeNetStepsNumbered,
  CubeNetTwoRows,
  CubeNetZigzag,
  CubePlanFront,
  DotStages,
  FlagRotation,
  FoldPunchSquare,
  GridTwoDiagonals,
  HeptagramSharp,
  LibraryBarChart,
  LShapeUnits,
  MenuTree,
  MuseumVisitorsChart,
  NumberGridRule,
  NumberLineArrow,
  PathsHomeParkSchool,
  PetsBarChart,
  PlusStages,
  PyramidRowStages,
  RainyDaysChart,
  RectangleSplitInThree,
  RideDistanceGraph,
  RoomUnfold,
  SquareWithCorner,
  StaircaseSquares,
  SymmetryCandidates,
  SymmetryGridDashed,
  TeeTileStages,
  TileFrameStages,
  TiltedSquareGrid,
  TravelPieChart,
  TriangleFanCrossed,
  TriangleSplitInThree,
  TriangleTwoIsosceles,
  TwoViewsOfSolid,
  UnitCubeBlock,
  ViewsFrontAndRight,
  WaterTankGraph,
};

export const FIGURE_NAMES = Object.keys(FIGURES).sort();
