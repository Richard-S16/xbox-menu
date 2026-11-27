import type { Direction } from "./input.ts";

type NavigationRow = { id: string; group?: "transport" };
type Layout = "list" | "confirmation" | "player";

export function nextFocus(
  rows: NavigationRow[], focus: string, direction: Direction, layout: Layout, trackRow?: string,
) {
  const selected = rows.find(row => row.id === focus);
  if (!selected) return;
  const horizontal = direction === "left" || direction === "right";
  const step = direction === "up" || direction === "left" ? -1 : 1;
  if (layout !== "player") {
    return (layout === "confirmation") === horizontal ? rows[rows.indexOf(selected) + step]?.id : undefined;
  }

  const group = rows.filter(row => row.group === selected.group);
  if (selected.group === "transport") {
    const neighbor = horizontal ? group[group.indexOf(selected) + step]?.id : undefined;
    return neighbor ?? (direction === "up" || direction === "left" ? rows.find(row => row.id === trackRow)?.id : undefined);
  }
  if (!horizontal) {
    const neighbor = group[group.indexOf(selected) + step];
    if (neighbor) return neighbor.id;
  }
  if (direction === "right" || direction === "down") return rows.find(row => row.id === "play")?.id;
}
