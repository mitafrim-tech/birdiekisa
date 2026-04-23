import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to a public bucket under the user's own folder.
 * Returns the public URL.
 */
export async function uploadUserFile(
  bucket: "avatars" | "team-logos",
  userId: string,
  file: File,
): Promise<string> {
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