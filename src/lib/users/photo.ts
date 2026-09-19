import { supabase } from "@/lib/supabase/client";

const BUCKET = "user-photos";
const MAX_BYTES = 2.5 * 1024 * 1024;

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function uploadUserPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes (JPG, PNG o WebP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La foto no debe superar 2.5 MB.");
  }

  const ext = extensionFor(file);
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust so the thumbnail refreshes after replace
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function setUserPhotoUrl(userId: string, photoUrl: string) {
  const { data, error } = await supabase.rpc("set_app_user_photo", {
    p_user_id: userId,
    p_photo_url: photoUrl,
  });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function removeUserPhoto(userId: string) {
  await supabase.storage.from(BUCKET).remove([
    `${userId}/avatar.jpg`,
    `${userId}/avatar.jpeg`,
    `${userId}/avatar.png`,
    `${userId}/avatar.webp`,
    `${userId}/avatar.gif`,
  ]);
  return setUserPhotoUrl(userId, "");
}
