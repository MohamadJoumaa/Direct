/**
 * `fmt` lives on its own so `notification-copy.ts` can use it without importing
 * the barrel: index -> notification-copy -> index is a real require cycle, and
 * Metro resolves it with `fmt` still uninitialized on the first pass.
 */

/** Replace {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
