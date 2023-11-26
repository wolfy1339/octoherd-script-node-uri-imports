// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@hellomouse/wolfy1339'],
  env: {
    node: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 1,
    'valid-jsdoc': 0
  }
};
