import globals from 'globals';

// Statická kontrola zdrojů LifeHubu. Vznikla po chybě ve verzi 4.8.5,
// kdy byla volána neexistující funkce merge() a syntaktická kontrola ji
// nedokázala odhalit.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/vendor/**']
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.serviceworker
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-constant-condition': 'error',
      'no-async-promise-executor': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-template-curly-in-string': 'warn',
      'valid-typeof': 'error',
      eqeqeq: ['warn', 'smart']
    }
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.serviceworker }
    },
    rules: { 'no-undef': 'error' }
  },
  {
    files: ['tests/**/*.mjs', 'scripts/**/*.mjs', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
