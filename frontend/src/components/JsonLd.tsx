// Renders a JSON-LD <script> tag. JSON.stringify already escapes quotes, but
// a literal "</script>" inside string data would still break out of the tag,
// so "<" is escaped to its unicode form before embedding.
export default function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
