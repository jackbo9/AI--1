export function splitDraftLines(value: string) {
  return value.split("\n");
}

export function normalizeLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}
