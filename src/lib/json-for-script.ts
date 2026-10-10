/**
 * src/lib/json-for-script.ts — JSON that is safe to place inside a <script>
 * element (JSON-LD via `set:html`, or an inline data assignment).
 *
 * JSON.stringify leaves `<` as is, so a value containing `</script>` or `<!--`
 * would end or change the script block; it also emits U+2028 / U+2029 raw.
 * Escaping them as \uXXXX keeps the JSON value identical (#884).
 */

export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** JSON.stringify for a JSON-LD (or other in-script) payload. */
export function stringifyJsonLd(value: unknown, space?: number): string {
  return escapeJsonForScript(JSON.stringify(value, null, space) ?? 'null');
}
