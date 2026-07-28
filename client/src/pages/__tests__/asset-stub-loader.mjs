/**
 * Node module-hook that stubs Vite-only `@assets/...` imports (images, etc.)
 * so client components can load under `tsx --test`. The `@assets` alias is
 * defined in vite.config.ts only, so plain Node/tsx cannot resolve it —
 * every such import becomes a module whose default export is a stub string.
 *
 * Registered from tests via:
 *   module.register(new URL("./asset-stub-loader.mjs", import.meta.url));
 */
const STUB = 'export default "asset-stub";';
const STUB_URL = "data:text/javascript," + encodeURIComponent(STUB);
const ASSET_RE = /\.(png|jpe?g|gif|webp|svg|ico|mp4|webm|woff2?|ttf)(\?.*)?$/i;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@assets/") || ASSET_RE.test(specifier)) {
    return { shortCircuit: true, url: STUB_URL };
  }
  return nextResolve(specifier, context);
}
