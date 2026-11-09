// reader.js - Straightedge reader: line through two known points → value on third scale

/**
 * Get the point on a scale for a given value.
 * @param {object} layout - Layout result from layout()
 * @param {number} scaleIndex - Scale index (0, 1, or 2)
 * @param {number} value - Value on the scale
 * @returns {{x: number, y: number}}
 */
export function pointOnScale(layout, scaleIndex, value) {
  const scale = layout.scales[scaleIndex];
  return scale.valueToPoint(value);
}

/**
 * Project a point orthogonally onto a scale segment and find the corresponding value.
 * @param {object} layout - Layout result from layout()
 * @param {object} chart - Chart definition from compile()
 * @param {number} scaleIndex - Scale index (0, 1, or 2)
 * @param {{x: number, y: number}} point - Point to project
 * @returns {{value: number, t: number} | {error: string}}
 */
export function valueAtPoint(layout, chart, scaleIndex, point) {
  const scale = layout.scales[scaleIndex];
  const p1 = { x: scale.x1, y: scale.y1 };
  const p2 = { x: scale.x2, y: scale.y2 };

  // Project point onto the line segment using least-squares
  // Project point onto infinite line through p1 and p2
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-15) {
    return { error: 'degenerate: scale segment is a point' };
  }

  const t_raw = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, t_raw)); // Clamp to [0, 1]

  const projPoint = {
    x: p1.x + t * dx,
    y: p1.y + t * dy
  };

  const value = scale.pointToValue(projPoint);

  // Check if value is in range
  const range = chart.scales[scaleIndex].range;
  if (value < range[0] - 1e-9 || value > range[1] + 1e-9) {
    return { error: 'out-of-range' };
  }

  return { value: Math.max(range[0], Math.min(range[1], value)), t };
}

/**
 * Draw a line through two known points and find where it intersects the third scale.
 * Returns the value on the third scale.
 * @param {object} layout - Layout result from layout()
 * @param {object} chart - Chart definition from compile()
 * @param {{scale: number, value: number}} a - First known point
 * @param {{scale: number, value: number}} b - Second known point
 * @returns {{scale: number, value: number, point: {x: number, y: number}} | {error: string}}
 */
export function solveLine(layout, chart, a, b) {
  // Validate that a and b are on different scales
  if (a.scale === b.scale) {
    return { error: 'degenerate: both points on same scale' };
  }

  // Compute the coordinates of the two known points
  const P1 = pointOnScale(layout, a.scale, a.value);
  const P2 = pointOnScale(layout, b.scale, b.value);

  // Check for degenerate case: identical points
  if (
    Math.abs(P1.x - P2.x) < 1e-12 &&
    Math.abs(P1.y - P2.y) < 1e-12
  ) {
    return { error: 'degenerate: points coincide' };
  }

  // Find the third scale (the one not in a or b)
  const allScales = [0, 1, 2];
  const thirdScaleIndex = allScales.find(
    i => i !== a.scale && i !== b.scale
  );

  // Get the third scale segment endpoints
  const thirdScale = layout.scales[thirdScaleIndex];
  const P3_min = { x: thirdScale.x1, y: thirdScale.y1 };
  const P3_max = { x: thirdScale.x2, y: thirdScale.y2 };

  // Check if the third scale is vertical or horizontal
  const isVertical = Math.abs(P3_max.x - P3_min.x) < 1e-12;
  const isHorizontal = Math.abs(P3_max.y - P3_min.y) < 1e-12;

  let point;

  if (isVertical) {
    // Scale is vertical: x is constant, solve for y
    const x_scale = P3_min.x;
    
    // Line: P(s) = P1 + s*(P2-P1)
    // At intersection: P(s).x = x_scale
    // P1.x + s*(P2.x - P1.x) = x_scale
    // s = (x_scale - P1.x) / (P2.x - P1.x)
    
    const dx = P2.x - P1.x;
    if (Math.abs(dx) < 1e-12) {
      // Line is vertical but scale is at a different x, no intersection
      return { error: 'degenerate: line parallel to scale segment' };
    }

    const s = (x_scale - P1.x) / dx;
    
    // Compute y at intersection
    const y = P1.y + s * (P2.y - P1.y);

    point = { x: x_scale, y };
  } else if (isHorizontal) {
    // Scale is horizontal: y is constant, solve for x
    const y_scale = P3_min.y;
    
    const dy = P2.y - P1.y;
    if (Math.abs(dy) < 1e-12) {
      // Line is horizontal but scale is at a different y, no intersection
      return { error: 'degenerate: line parallel to scale segment' };
    }

    const s = (y_scale - P1.y) / dy;
    
    // Compute x at intersection
    const x = P1.x + s * (P2.x - P1.x);

    point = { x, y: y_scale };
  } else {
    // Diagonal scale: use general line-segment intersection
    // Line through P1 and P2: L(s) = P1 + s * (P2 - P1)
    // Segment P3: S(t) = P3_min + t * (P3_max - P3_min), t ∈ [0, 1]
    // Find intersection: P1 + s*(P2-P1) = P3_min + t*(P3_max-P3_min)
    // Rearranged: s*(P2-P1) - t*(P3_max-P3_min) = P3_min - P1

    const dir1 = { x: P2.x - P1.x, y: P2.y - P1.y };
    const dir2 = { x: P3_max.x - P3_min.x, y: P3_max.y - P3_min.y };
    const p0 = { x: P3_min.x - P1.x, y: P3_min.y - P1.y };

    // Solve using Cramer's rule: s * dir1 - t * dir2 = p0
    // Matrix: [dir1.x, -dir2.x] [s] = [p0.x]
    //         [dir1.y, -dir2.y] [t]   [p0.y]
    // det = dir1.x*(-dir2.y) - dir1.y*(-dir2.x) = -(dir1.x*dir2.y - dir1.y*dir2.x)
    const det = -(dir1.x * dir2.y - dir1.y * dir2.x);

    if (Math.abs(det) < 1e-12) {
      return { error: 'degenerate: line parallel to scale segment' };
    }

    // Cramer's rule for t:
    // det([[p0.x, -dir2.x], [p0.y, -dir2.y]]) / det
    // = (p0.x*(-dir2.y) - p0.y*(-dir2.x)) / det
    // = -(p0.x*dir2.y - p0.y*dir2.x) / det
    // But our det is already negated, so:
    // t = (p0.x*dir2.y - p0.y*dir2.x) / (-det_unnegated) = -(p0.x*dir2.y - p0.y*dir2.x) / (dir1.x*dir2.y - dir1.y*dir2.x)
    // Actually, more simply: t = (dir1.x * p0.y - dir1.y * p0.x) / det
    const t = (dir1.x * p0.y - dir1.y * p0.x) / det;

    // Check if t is in valid range (with small tolerance for numerical error)
    if (t < -1e-9 || t > 1 + 1e-9) {
      return { error: 'out-of-range' };
    }

    // Clamp t to [0, 1]
    const t_clamped = Math.max(0, Math.min(1, t));

    // Compute the intersection point
    point = {
      x: P3_min.x + t_clamped * dir2.x,
      y: P3_min.y + t_clamped * dir2.y
    };
  }

  // Invert to get the value
  const value = thirdScale.pointToValue(point);

  // Check if value is in range
  const range = chart.scales[thirdScaleIndex].range;
  if (value < range[0] - 1e-9 || value > range[1] + 1e-9) {
    return { error: 'out-of-range' };
  }

  return {
    scale: thirdScaleIndex,
    value: Math.max(range[0], Math.min(range[1], value)),
    point
  };
}

/**
 * Read the third scale by providing values on two other scales.
 * @param {object} layout - Layout result from layout()
 * @param {object} chart - Chart definition from compile()
 * @param {{scale: number, value: number}} input1 - First known input
 * @param {{scale: number, value: number}} input2 - Second known input
 * @returns {number | {error: string}}
 */
export function readThirdScale(layout, chart, input1, input2) {
  const result = solveLine(layout, chart, input1, input2);
  if (result.error) {
    return { error: result.error };
  }
  return result.value;
}
