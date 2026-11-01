export function scoreLayout(width: number, measures: number, division: number, singleRow = false) {
  const padding = 20
  const rowHeight = 120
  const minMeasureWidth = Math.max(240, division * 16)
  const available = Math.max(minMeasureWidth, width - padding * 2)
  const perRow = singleRow
    ? measures
    : Math.min(measures, Math.max(1, Math.floor(available / minMeasureWidth)))
  // A following viewport spans roughly six beats, with context on both sides.
  const measureWidth = singleRow
    ? Math.max(minMeasureWidth, available / 1.5)
    : Math.max(minMeasureWidth, available / perRow)

  return {
    padding,
    rowHeight,
    perRow,
    measureWidth,
    totalWidth: padding * 2 + measureWidth * perRow,
    height: Math.ceil(measures / perRow) * rowHeight + 20,
  }
}

export function followOffset(center: number, viewportWidth: number) {
  // Leave blank space at either end so even the first and last note stay centered.
  return viewportWidth / 2 - center
}
