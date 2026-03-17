/** Parse attachment_url field into an array of URLs.
 *  Handles: null, single URL string, JSON array string */
export function parseAttachmentUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [trimmed];
}

/** Serialize an array of URLs into the attachment_url field value */
export function serializeAttachmentUrls(urls: string[]): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

/** Check if a URL points to an image */
export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}
