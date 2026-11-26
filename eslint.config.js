import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'src/sw/sw.js'] },
  ...tseslint.configs.strict,
  {
    rules: {
      // Interdit l'injection de HTML brut : tout contenu externe est affiché comme texte.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Interdit : afficher le contenu comme texte.',
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Interdit : utiliser textContent.',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
