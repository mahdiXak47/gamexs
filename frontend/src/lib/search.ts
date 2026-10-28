// Title search that understands the short forms players type: "gta vi",
// "gta 6", "rdr2", "red dead 2", "nfs unbound", "tlou", "ff7".
//
// Title and query go through the same normalization (lowercase, punctuation
// out, roman numerals II–X as digits). The title's search key is its words
// run together (so "spiderman" finds "Spider-Man"), then their initials
// ("grand theft auto 6 grandtheftauto6 gta6"), and a game
// matches when every query word appears somewhere in that key.
// ponytail: computed per query over the ~2,000-row catalog; move to a stored
// generated column with a trigram index if search gets slow.

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

/** Query words, normalized the same way as `titleSearchKey`. */
export function searchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => ROMAN[word] ?? word);
}

const romanToDigits = (sql: string) =>
  Object.entries(ROMAN).reduce((expr, [roman, digit]) => `regexp_replace(${expr}, '\\m${roman}\\M', '${digit}', 'g')`, sql);

/** SQL for a title's search key: normalized words, then their initials. */
export function titleSearchKey(column: string): string {
  const words = romanToDigits(
    `btrim(regexp_replace(regexp_replace(lower(${column}), '[''’]', '', 'g'), '[^[:alnum:]]+', ' ', 'g'))`
  );
  return `(${words} || ' ' || replace(${words}, ' ', '') || ' ' || regexp_replace(${words}, '(\\S)\\S*\\s*', '\\1', 'g'))`;
}

/** SQL condition: every token in the `text[]` parameter is in the title's key. */
export function titleMatchesTokens(column: string, tokensParam: string): string {
  return `NOT EXISTS (SELECT 1 FROM unnest(${tokensParam}::text[]) t WHERE strpos(${titleSearchKey(column)}, t) = 0)`;
}
