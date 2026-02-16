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
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": "warn",
    "no-debugger": "error"
  },
  overrides: [
    {
      files: [
        "packages/ui-kit/src/**/*.{ts,tsx}",
        "apps/ruleflow-web/src/**/*.{ts,tsx}"
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@mui/*"],
                "message": "Core platform UI layers must not import MUI directly."
              }
            ]
          }
        ]
      }
    },
    {
      files: [
        "apps/ruleflow-web/src/components/layout/**/*.{ts,tsx}",
        "apps/ruleflow-web/src/app/system/ui-kit/**/*.{ts,tsx}"
      ],
      excludedFiles: ["apps/ruleflow-web/src/components/layout/theme-provider.tsx"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "JSXAttribute[name.name='style']",
            "message": "Use token-driven classes and CSS modules. Inline styles are reserved for theme variable application only."
          }
        ]
      }
    }
  ]
};
