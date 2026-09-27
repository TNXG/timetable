import antfu from "@antfu/eslint-config";

const atf = antfu({
  ignores: [
    "node_modules/**",
    "dist/**",
    "android/**",
    "docs/**",
    ".agents/**",
    "**/AGANT.md",
  ],
  formatters: true,
  react: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
  },
  rules: {
    "semi": ["warn", "always"],
    /* 与 brace-style 的 allowSingleLine 一致：一行内写 `if (x) { a; return; }` / `() => { a; b; }` 是本项目既定写法 */
    "style/max-statements-per-line": "off",
    "antfu/top-level-function": "off",
    "eslinttailwindcss/no-custom-classname": "off",
    "no-console": "off",
    "style/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "node/prefer-global/process": "off",
    "react-refresh/only-export-components": "off",
  },
});

export default atf;
