/**
 * Hermes ships none of the ES2023 "change array by copy" methods, so
 * `toSorted` and `toReversed` are `undefined` on native — `adminProfiles()`
 * threw "undefined is not a function" the moment Admin → Settings rendered.
 *
 * The shared packages use them freely because the website's V8 has them, and
 * forking a domain rule between the two clients to dodge a missing method is
 * exactly what this codebase must not do. So the method comes to Hermes
 * instead. `toSpliced` / `with` are unused today; add them here if that changes.
 *
 * Imported first from `app/_layout.tsx`. Every call site runs during render or
 * later — never at module scope — so this is always installed in time.
 */
const proto = Array.prototype as unknown as Record<string, unknown>;

function install(name: string, value: unknown) {
  if (typeof proto[name] === "function") return;
  Object.defineProperty(Array.prototype, name, {
    value,
    writable: true,
    configurable: true,
    // Non-enumerable, or every `for...in` over an array would suddenly see it.
    enumerable: false,
  });
}

install("toSorted", function toSorted(this: unknown[], compare?: (a: unknown, b: unknown) => number) {
  return [...this].sort(compare);
});

install("toReversed", function toReversed(this: unknown[]) {
  return [...this].reverse();
});
