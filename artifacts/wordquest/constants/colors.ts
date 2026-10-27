/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#1a1a1a',
    tint: '#2f80ed',

    // Core surfaces
    background: '#f0f0f3',
    foreground: '#1a1a1a',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#1a1a1a',

    // Primary action color (buttons, links, active states)
    primary: '#2f80ed',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e7e7ed',
    secondaryForeground: '#1a1a1a',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#e9e9ef',
    mutedForeground: '#777783',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#fff0dc',
    accentForeground: '#a45100',

    // Destructive actions (delete, error states)
    destructive: '#f83f8f',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e2e2e9',
    input: '#e2e2e9',
    orange: '#ff8c1a',
    pink: '#f83f8f',
    found: '#c0c0c8',
    ink: '#1a1a1a',
    yellow: '#ffd84d',
    navy: '#17285b',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 20,
};

export default colors;
