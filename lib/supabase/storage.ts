import { createClient } from "@/lib/supabase/server"

export async function uploadDishPhoto(file: File, restaurantId: string): Promise<string> {
  const supabase = createClient()
  const maxSize = 10 * 1024 * 1024
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]

  if (file.size > maxSize) throw new Error("Image trop grande (max 10MB)")
  if (!allowedTypes.includes(file.type)) throw new Error("Format invalide (JPEG, PNG, WebP)")

  const fileName = `${restaurantId}/${Date.now()}-${crypto.randomUUID()}.jpg`

  const { data, error } = await supabase.storage
    .from("dish-photos")
    .upload(fileName, file, { contentType: file.type, upsert: false })

  if (error) throw error
  return data.path
}
