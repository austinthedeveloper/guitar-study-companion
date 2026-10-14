import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'playwright/expect-expect': [
        'warn',
        {
          assertFunctionNames: [
            'expectNoA11yViolations',
            'reachReview',
            'upload',
            'selectPassage',
          ],
        },
      ],
    },
  },
];
