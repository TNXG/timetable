import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

function jsxCompiler(svg: string) {
  const jsx = svg
    .replace(/\bclass=/g, "className=")
    .replace(/\b(clip-rule|fill-rule|fill-opacity|stroke-linecap|stroke-linejoin|stroke-width|stroke-opacity)=/g, (_, name: string) => `${name.replace(/-([a-z])/g, (_m, letter: string) => letter.toUpperCase())}=`)
    .replace(/<svg\b([^>]*)>/, "<svg$1 {...props}>");
  return `export default function Icon(props) { return ${jsx} }`;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), Icons({ compiler: { extension: "jsx", compiler: jsxCompiler } })],
});
