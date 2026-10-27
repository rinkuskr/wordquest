export const HIGHLIGHT_COLORS = [
  '#FF6B6B',
  '#FFA94D',
  '#FFD43B',
  '#A9E34B',
  '#69DB7C',
  '#38D9A9',
  '#3BC9DB',
  '#4DABF7',
  '#748FFC',
  '#9775FA',
  '#DA77F2',
  '#F783AC',
  '#FF8787',
  '#FFC078',
  '#8CE99A',
  '#66D9E8',
  '#91A7FF',
  '#E599F7',
] as const;

export function withOpacity(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
