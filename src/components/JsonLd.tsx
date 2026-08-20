/**
 * Structured data, rendered server-side.
 *
 * A plain `<script type="application/ld+json">` rather than next/script:
 * crawlers read the HTML they are served, and next/script's strategies exist
 * to defer execution — which is the opposite of what is wanted for a tag that
 * is never executed at all, only parsed.
 *
 * `<` is escaped because a stray `</script>` inside any string would close the
 * tag early and spill the rest of the JSON into the page as text. Nothing here
 * is user-authored today, but a doctor's own biography passes through this and
 * that is exactly the kind of field that stops being trusted input later.
 */
export default function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // The content is serialised by us from typed values, never from a
      // request.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
