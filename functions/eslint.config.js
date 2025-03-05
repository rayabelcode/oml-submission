import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import nodePlugin from "eslint-plugin-n";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        console: "readonly",
        setTimeout: "readonly",
        require: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      stylistic,
      n: nodePlugin,
    },
    rules: {
      // Style rules
      "stylistic/indent": ["error", 2],
      "stylistic/quotes": ["error", "double", { "allowTemplateLiterals": true }],
      "stylistic/object-curly-spacing": ["error", "always"],
      "stylistic/comma-spacing": ["error", { "before": false, "after": true }],
      "stylistic/no-trailing-spaces": "error",

      // Functionality rules
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_|event" }],
      "no-restricted-globals": ["error", "name", "length"],
      "prefer-arrow-callback": "error",

      // Node specific rules
      "n/no-missing-import": "off",
      "n/no-missing-require": "off",
      "n/no-unpublished-import": "off",

      // Maximum line length
      "max-len": ["error", { "code": 120 }],
    },
  },
  {
    ignores: ["src/*.js", "node_modules/**"]
  }
];
