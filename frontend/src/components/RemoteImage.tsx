import Image, { type ImageProps } from "next/image";
import { isS3ImageUrl } from "@/lib/covers";

/**
 * GameXS media is already resized and encoded as WebP by the scraper, and the
 * object store serves it with an immutable one-year cache header. Sending it
 * through Next's optimizer adds a cold server-side fetch and re-encode for
 * every requested width, so bypass optimization for those assets only.
 */
export default function RemoteImage(props: ImageProps) {
  const isGameXsMedia = typeof props.src === "string" && isS3ImageUrl(props.src);

  return <Image {...props} alt={props.alt} unoptimized={props.unoptimized || isGameXsMedia} />;
}
