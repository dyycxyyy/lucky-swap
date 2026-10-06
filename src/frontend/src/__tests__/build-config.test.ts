/**
 * Build and runtime configuration contracts.
 *
 * These three accepted changes are configuration-level, so the observable
 * behavior is the configuration itself: the Vite build must minify without
 * emitting sourcemaps, the app's React Query client must use the accepted
 * defaults, and the unused `react-icons` dependency must be gone from both the
 * manifest and every source import. Reading the real files (rather than a
 * fixture) is what makes these regressions visible.
 *
 * Paths are resolved from the frontend package root, which is Vitest's cwd for
 * this suite (`pnpm --dir src/frontend test`).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const FRONTEND_ROOT = process.cwd();

function readFrontendFile(relativePath: string): string {
  return readFileSync(join(FRONTEND_ROOT, relativePath), "utf8");
}

/** Recursively collect every `.ts`/`.tsx` source file under `src/`. */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("Vite build configuration", () => {
  it("enables minification and keeps sourcemaps disabled", () => {
    const config = readFrontendFile("vite.config.js");

    // `minify: true` or `minify: "esbuild"` both mean the bundle is minified.
    expect(config).toMatch(/minify:\s*(true|["']esbuild["'])/);
    expect(config).toMatch(/sourcemap:\s*false/);
  });
});

describe("React Query client defaults", () => {
  it("constructs the QueryClient with the accepted staleTime and focus behavior", () => {
    const main = readFrontendFile("src/main.tsx");

    expect(main).toMatch(/new QueryClient\(/);
    expect(main).toMatch(/staleTime:\s*5_?000/);
    expect(main).toMatch(/refetchOnWindowFocus:\s*false/);
    // The client must still be handed to the provider that wraps the app.
    expect(main).toMatch(/<QueryClientProvider\s+client=\{queryClient\}>/);
  });
});

describe("route loading", () => {
  it("does not lazy-load routes", () => {
    // The accepted change explicitly keeps routes eagerly imported. Scan
    // production source only; test files legitimately use dynamic imports.
    const offenders = collectSourceFiles(join(FRONTEND_ROOT, "src"))
      .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) =>
        /React\.lazy\(|\blazy\(/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(FRONTEND_ROOT, file));

    expect(offenders).toEqual([]);
  });
});

describe("react-icons removal", () => {
  it("does not list react-icons in the frontend manifest", () => {
    const pkg = JSON.parse(readFrontendFile("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies ?? {}).not.toHaveProperty("react-icons");
    expect(pkg.devDependencies ?? {}).not.toHaveProperty("react-icons");
  });

  it("has no source file importing from react-icons", () => {
    const offenders = collectSourceFiles(join(FRONTEND_ROOT, "src"))
      .filter((file) =>
        /from\s+["']react-icons/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(FRONTEND_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
