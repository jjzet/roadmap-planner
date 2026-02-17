/** Compute a squared SVG path with rounded corners for a dependency arrow.
 *
 * Normal case (target is well to the right of source):
 *   horizontal → corner → vertical → corner → horizontal to target left edge
 *
 * Close/overlapping case (target left edge is near or before source right edge):
 *   Route right beyond both bars, go vertical, then loop left past the target's
 *   left edge, go vertical to target Y, then approach from the left.
 *   This ensures the arrowhead always points rightward into the target.
 */
export function computeArrowPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  const r = 8; // corner radius
  const dy = toY - fromY;
  const dx = toX - fromX;
  const MIN_HORIZONTAL_GAP = 40;

  // If same Y (horizontal line)
  if (Math.abs(dy) < 2) {
    if (dx > 0) {
      return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    }
    // Target is to the left — need a loop
  }

  const signY = dy > 0 ? 1 : -1;
  const absDy = Math.abs(dy);

  // Close/overlapping case: loop right, down, left, then approach target from left
  if (dx < MIN_HORIZONTAL_GAP) {
    const rightOffsetX = Math.max(fromX, toX) + 30;
    const leftOffsetX = toX - 30;
    // Vertical midpoint: halfway between source Y and target Y
    // We go vertical in two stages: first to a mid-Y at the right offset,
    // then horizontal across to the left offset, then vertical down to target Y
    const midY = fromY + dy / 2;
    const halfDy = Math.abs(dy) / 2;
    const cr1 = Math.min(r, halfDy / 2);

    return [
      // Start at source right edge
      `M ${fromX} ${fromY}`,
      // Horizontal right to offset
      `L ${rightOffsetX - cr1} ${fromY}`,
      // Corner: turn vertical
      `Q ${rightOffsetX} ${fromY}, ${rightOffsetX} ${fromY + signY * cr1}`,
      // Vertical to midY
      `L ${rightOffsetX} ${midY - signY * cr1}`,
      // Corner: turn left
      `Q ${rightOffsetX} ${midY}, ${rightOffsetX - cr1} ${midY}`,
      // Horizontal left to left offset
      `L ${leftOffsetX + cr1} ${midY}`,
      // Corner: turn vertical again
      `Q ${leftOffsetX} ${midY}, ${leftOffsetX} ${midY + signY * cr1}`,
      // Vertical to target Y
      `L ${leftOffsetX} ${toY - signY * cr1}`,
      // Corner: turn right toward target
      `Q ${leftOffsetX} ${toY}, ${leftOffsetX + cr1} ${toY}`,
      // Horizontal right to target left edge (arrowhead points right)
      `L ${toX} ${toY}`,
    ].join(' ');
  }

  // Normal case: route through midpoint
  const midX = fromX + dx / 2;
  const clampedR = Math.min(r, absDy / 2, Math.abs(midX - fromX), Math.abs(toX - midX));

  return [
    `M ${fromX} ${fromY}`,
    `L ${midX - clampedR} ${fromY}`,
    `Q ${midX} ${fromY}, ${midX} ${fromY + signY * clampedR}`,
    `L ${midX} ${toY - signY * clampedR}`,
    `Q ${midX} ${toY}, ${midX + clampedR} ${toY}`,
    `L ${toX} ${toY}`,
  ].join(' ');
}
