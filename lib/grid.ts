export function rowGridTemplate(columnCount: number) {
  return `36px minmax(220px,1fr) repeat(${columnCount}, 150px)`;
}

export function headerGridTemplate(columnCount: number) {
  return `${rowGridTemplate(columnCount)} 44px`;
}
