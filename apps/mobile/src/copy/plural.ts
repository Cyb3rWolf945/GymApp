/** "1 set", "2 sets", "0 sets": the count and the right form of the noun. Pass `many` for irregular plurals ("entry", "entries"). */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
