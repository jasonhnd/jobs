/** Reader-local date, deliberately independent of the scoring/publication dates. */
export function localAccessDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function citationForCopy(text: string, now: Date): string {
  return text.replaceAll('{{accessed_on}}', localAccessDate(now));
}
