import { supabase } from "@/integrations/supabase/client";

/**
 * Hard ceiling on uploaded images. Phone cameras routinely produce 4 MB+
 * JPEGs; 15 MB ceiling on the original — we downscale to a small WebP
 * before uploading, so the actual stored asset is tiny.
 */
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Output sizing for resized avatars/logos. Displayed at ~48–80px @2x. */
const MAX_DIMENSION = 512;
const WEBP_QUALITY = 0.82;

/**
 * Throw an error that `toUserMessage` will surface verbatim (instead of
 * collapsing to a generic fallback). The Finnish text lands directly in
 * the toast the caller shows.
 */
function userError(msg: string): Error {
  const err = new Error(msg) as Error & { userMessage: string };
  err.userMessage = msg;
  return err;
}

/**
 * Decode → resize → re-encode as WebP using a canvas. Falls back to the
 * original file if the browser can't decode it (rare HEIC on desktop, or
 * canvas blocked). Drops typical 3 MB phone JPEGs to ~30 KB.
 */
async function resizeToWebp(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  // HEIC/HEIF can't be decoded by <img> in most browsers — leave as-is and
  // let the server store the original. Display sites that need a thumbnail
  // will get a one-off backfill later.
  if (file.type === "image/heic" || file.type === "image/heif") {
    return { blob: file, ext: file.name.split(".").pop() || "heic", type: file.type };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) throw new Error("encode failed");
    return { blob, ext: "webp", type: "image/webp" };
  } catch {
    // Fall back to the original file rather than blocking the upload.
    return { blob: file, ext: file.name.split(".").pop() || "jpg", type: file.type || "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload a file to a public bucket under the user's own folder.
 * Returns the public URL.
 */
export async function uploadUserFile(bucket: "avatars" | "team-logos", userId: string, file: File): Promise<string> {
  // Validate before we go near the network. The storage policies will
  // reject obvious nonsense too, but the user-visible feedback is much
  // friendlier when we catch it here.
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw userError("Vain JPEG, PNG, WebP tai HEIC kelpaa.");
  }
  if (file.size > MAX_BYTES) {
    throw userError("Kuva on liian iso (max 15 MB).");
  }

  const { blob, ext, type } = await resizeToWebp(file);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    // 1 year — paths are UUIDs so the asset is effectively immutable.
    cacheControl: "31536000",
    upsert: false,
    contentType: type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
