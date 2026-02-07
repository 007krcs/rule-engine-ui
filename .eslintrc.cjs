module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["dist", "build", "coverage", "node_modules"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": "error"
  }
};
