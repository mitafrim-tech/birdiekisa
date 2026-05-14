import { supabase } from "@/integrations/supabase/client";

/**
 * Hard ceiling on uploaded images. Phone cameras routinely produce 4 MB+
 * JPEGs; 5 MB is plenty of headroom for the eventual avatar/logo display.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

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
    throw userError("Kuva on liian iso (max 5 MB).");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
