// Rows and the header must share one template — any difference (e.g. the
// header having an extra trailing column the rows don't) changes how much
// space the flexible `minmax(220px,1fr)` Item column absorbs in each case,
// shifting every column after it out of alignment between header and rows.
export function rowGridTemplate(columnCount: number) {
  return `36px minmax(220px,1fr) repeat(${columnCount}, 150px) 44px`;
}

export function headerGridTemplate(columnCount: number) {
  return rowGridTemplate(columnCount);
}
