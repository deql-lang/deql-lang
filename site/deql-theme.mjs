// Custom Night Owl theme with DeQL-specific token colors
// Extends the default Night Owl with additional rules for DeQL scopes

/** @type {import('shiki').ThemeRegistrationRaw} */
export default {
  name: 'deql-night-owl',
  type: 'dark',
  colors: {
    // Night Owl base colors
    'editor.background': '#011627',
    'editor.foreground': '#d6deeb',
    'editor.selectionBackground': '#1d3b53',
    'editorCursor.foreground': '#80a4c2',
    'editorLineNumber.foreground': '#4b6479',
  },
  tokenColors: [
    // --- DeQL-specific tokens (MUST come before SQL) ---
    {
      name: 'DeQL Keywords',
      scope: 'keyword.other.deql',
      settings: { foreground: '#F78C6C', fontStyle: 'bold' },
    },
    {
      name: 'DeQL Identifiers ($Agg, $Events)',
      scope: 'entity.name.type.deql',
      settings: { foreground: '#7FDBCA' },
    },
    {
      name: 'DeQL Bind Parameters (:name)',
      scope: 'variable.parameter.deql',
      settings: { foreground: '#ADDB67' },
    },
    {
      name: 'DeQL Assignment (:=)',
      scope: 'keyword.operator.assignment.deql',
      settings: { foreground: '#C792EA' },
    },
    {
      name: 'DeQL Success Mark (✓)',
      scope: 'markup.inserted.deql',
      settings: { foreground: '#22DA6E', fontStyle: 'bold' },
    },
    {
      name: 'DeQL Failure Mark (✗)',
      scope: 'markup.deleted.deql',
      settings: { foreground: '#EF5350', fontStyle: 'bold' },
    },
    {
      name: 'DeQL Functions (LAST, FIRST, etc.)',
      scope: 'support.function.deql',
      settings: { foreground: '#82AAFF' },
    },
    // --- SQL tokens ---
    {
      name: 'SQL Keywords',
      scope: 'keyword.other.sql',
      settings: { foreground: '#C792EA' },
    },
    // --- Standard tokens ---
    {
      name: 'Comments',
      scope: 'comment',
      settings: { foreground: '#637777', fontStyle: 'italic' },
    },
    {
      name: 'Strings',
      scope: 'string',
      settings: { foreground: '#ECC48D' },
    },
    {
      name: 'Numbers',
      scope: 'constant.numeric',
      settings: { foreground: '#F78C6C' },
    },
    {
      name: 'Default text',
      scope: 'source',
      settings: { foreground: '#D6DEEB' },
    },
  ],
};
