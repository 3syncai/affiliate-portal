/** Strip trailing " State" suffix (e.g. "Uttar Pradesh State" → "Uttar Pradesh"). */
export function normalizeStateParam(state: string): string {
  return state.replace(/\s+State$/i, "").trim();
}
