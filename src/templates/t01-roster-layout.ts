/** Shared native-pixel geometry for the draft preview and final longform. */
export function rosterRowHeight(entrantCount: number) {
  const rows = Math.max(1, Math.ceil(entrantCount / 2));
  return 51 + rows * 33.35 + (rows - 1) * 15;
}

export function rosterLayout(groups: Array<{ entrants: unknown[] }>) {
  const recapTop = 1700 + groups.reduce((sum, group) => sum + rosterRowHeight(group.entrants.length), 0) + 54.5;
  return { recapTop, height: recapTop + 582 };
}
