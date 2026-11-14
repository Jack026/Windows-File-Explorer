import { TreemapNode } from '../types';

export interface LayoutRect {
  node: TreemapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * High-performance Squarified Treemap layout algorithm.
 * Positions hierarchical items into proportional rectangles that fit inside [width, height].
 */
export function computeSquarifiedTreemap(
  root: TreemapNode,
  width: number,
  height: number,
  padding = 3
): LayoutRect[] {
  if (!root || !root.children || root.children.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  // Filter out 0-size nodes and sort descending
  const validChildren = root.children
    .filter((c) => c.size > 0)
    .sort((a, b) => b.size - a.size);

  if (validChildren.length === 0) return [];

  const totalSize = validChildren.reduce((sum, c) => sum + c.size, 0);
  if (totalSize <= 0) return [];

  const rects: LayoutRect[] = [];
  squarify(validChildren, [], { x: 0, y: 0, w: width, h: height }, totalSize, rects, padding);

  return rects;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(
  children: TreemapNode[],
  row: TreemapNode[],
  bounds: Bounds,
  totalSize: number,
  results: LayoutRect[],
  padding: number
) {
  if (children.length === 0) {
    layoutRow(row, bounds, totalSize, results, padding);
    return;
  }

  const child = children[0];
  const rest = children.slice(1);

  if (row.length === 0) {
    squarify(rest, [child], bounds, totalSize, results, padding);
    return;
  }

  const currentWorst = worstAspectRatio(row, bounds, totalSize);
  const nextWorst = worstAspectRatio([...row, child], bounds, totalSize);

  if (nextWorst <= currentWorst) {
    squarify(rest, [...row, child], bounds, totalSize, results, padding);
  } else {
    const remainingBounds = layoutRow(row, bounds, totalSize, results, padding);
    const remainingTotal = children.reduce((s, c) => s + c.size, 0);
    squarify(children, [], remainingBounds, remainingTotal, results, padding);
  }
}

function worstAspectRatio(row: TreemapNode[], bounds: Bounds, totalSize: number): number {
  if (row.length === 0 || totalSize <= 0) return Infinity;

  const shortestSide = Math.min(bounds.w, bounds.h);
  if (shortestSide <= 0) return Infinity;

  const rowTotal = row.reduce((s, c) => s + c.size, 0);
  const rowArea = (rowTotal / totalSize) * (bounds.w * bounds.h);

  const rowSide = rowArea / shortestSide;
  if (rowSide <= 0) return Infinity;

  let maxAspect = 0;
  for (const item of row) {
    const itemArea = (item.size / totalSize) * (bounds.w * bounds.h);
    const itemSide = itemArea / rowSide;
    const aspect = Math.max(itemSide / rowSide, rowSide / itemSide);
    if (aspect > maxAspect) maxAspect = aspect;
  }

  return maxAspect;
}

function layoutRow(
  row: TreemapNode[],
  bounds: Bounds,
  totalSize: number,
  results: LayoutRect[],
  padding: number
): Bounds {
  if (row.length === 0 || totalSize <= 0) return bounds;

  const isHorizontal = bounds.w >= bounds.h;
  const rowTotal = row.reduce((s, c) => s + c.size, 0);
  const rowPortion = (rowTotal / totalSize);

  if (isHorizontal) {
    const rowWidth = Math.max(1, bounds.w * rowPortion);
    let currentY = bounds.y;

    for (const item of row) {
      const itemPortion = item.size / rowTotal;
      const itemHeight = Math.max(1, bounds.h * itemPortion);

      results.push({
        node: item,
        x: bounds.x + padding,
        y: currentY + padding,
        w: Math.max(1, rowWidth - padding * 2),
        h: Math.max(1, itemHeight - padding * 2),
      });

      currentY += itemHeight;
    }

    return {
      x: bounds.x + rowWidth,
      y: bounds.y,
      w: Math.max(0, bounds.w - rowWidth),
      h: bounds.h,
    };
  } else {
    const rowHeight = Math.max(1, bounds.h * rowPortion);
    let currentX = bounds.x;

    for (const item of row) {
      const itemPortion = item.size / rowTotal;
      const itemWidth = Math.max(1, bounds.w * itemPortion);

      results.push({
        node: item,
        x: currentX + padding,
        y: bounds.y + padding,
        w: Math.max(1, itemWidth - padding * 2),
        h: Math.max(1, rowHeight - padding * 2),
      });

      currentX += itemWidth;
    }

    return {
      x: bounds.x,
      y: bounds.y + rowHeight,
      w: bounds.w,
      h: Math.max(0, bounds.h - rowHeight),
    };
  }
}
