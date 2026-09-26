import { useWindowDimensions } from "react-native";

/**
 * Exact pixel width for one cell of an N-column grid. Percentage widths plus
 * fixed gaps overflow on narrow phones and wrap into ragged rows; this doesn't.
 * `inset` is the horizontal padding around the grid (screens use 20 + 20).
 */
export function useColumnWidth(columns: number, gap: number, inset = 40) {
  const { width } = useWindowDimensions();
  return Math.floor((width - inset - gap * (columns - 1)) / columns);
}
