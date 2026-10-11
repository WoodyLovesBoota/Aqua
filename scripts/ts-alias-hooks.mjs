import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  let s = specifier;
  if (s.startsWith("@/")) s = new URL(s.slice(2), SRC).href;
  const relative = s.startsWith("./") || s.startsWith("../");
  if ((relative || s.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(s)) {
    const base = relative ? new URL(s, context.parentURL).href : s;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(fileURLToPath(base + ext))) {
        s = base + ext;
        break;
      }
    }
  }
  return next(s, context);
}
