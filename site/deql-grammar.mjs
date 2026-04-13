// Custom DeQL TextMate grammar extending SQL with DeQL-specific keywords
// SQL keywords: matched by source.sql (purple in Night Owl)
// DeQL keywords: keyword.other.deql (orange/gold — distinct from SQL)
// DeQL identifiers ($Agg, $Events): entity.name.type.deql (cyan)
// Bind parameters (:name): variable.parameter.deql (green)

/** @type {import('shiki').LanguageRegistration} */
export default {
  name: 'deql',
  scopeName: 'source.deql',
  patterns: [
    { include: '#deql-line-comment' },
    { include: '#deql-strings' },
    { include: '#deql-numbers' },
    { include: '#deql-assign' },
    { include: '#deql-bind-params' },
    { include: '#deql-identifiers' },
    { include: '#deql-keywords' },
    { include: '#sql-keywords' },
    { include: '#deql-functions' },
  ],
  repository: {
    'deql-line-comment': {
      match: '--.*$',
      name: 'comment.line.double-dash.deql',
    },
    'deql-strings': {
      match: "'[^']*'",
      name: 'string.quoted.single.deql',
    },
    'deql-numbers': {
      match: '\\b\\d+(\\.\\d+)?\\b',
      name: 'constant.numeric.deql',
    },
    'deql-keywords': {
      match: '\\b(AGGREGATE|COMMAND|DECISION|EVENT|EVENTSTORE|PROJECTION|TEMPLATE|DEREG|INSPECT|EXECUTE|DESCRIBE|VALIDATE|EXPORT|EMIT|APPLY|AGGREGATES|COMMANDS|DECISIONS|EVENTS|PROJECTIONS|EVENTSTORES)\\b',
      name: 'keyword.other.deql',
    },
    'sql-keywords': {
      match: '\\b(CREATE|SELECT|FROM|WHERE|GROUP|BY|ORDER|AS|ON|FOR|AND|OR|NOT|IN|IS|NULL|INTO|SET|UPDATE|INSERT|DELETE|DROP|ALTER|REPLACE|JOIN|LEFT|RIGHT|INNER|OUTER|UNION|ALL|DISTINCT|HAVING|LIMIT|OFFSET|CASE|WHEN|THEN|ELSE|END|WITH|VALUES|TABLE|TRUE|FALSE|ASC|DESC|LIKE|BETWEEN|EXISTS|COUNT|SUM|AVG|MIN|MAX|FILTER|COALESCE|CONCAT|NOW)\\b',
      name: 'keyword.other.sql',
    },
    'deql-functions': {
      match: '\\b(LAST|GENERATE_ID|ENV|DATE|YEAR)\\b',
      name: 'support.function.deql',
    },
    'deql-identifiers': {
      match: '\\$(?:Agg|Events)\\b',
      name: 'entity.name.type.deql',
    },
    'deql-bind-params': {
      match: ':[a-zA-Z_][a-zA-Z0-9_]*',
      name: 'variable.parameter.deql',
    },
    'deql-assign': {
      match: ':=',
      name: 'keyword.operator.assignment.deql',
    },
  },
};
