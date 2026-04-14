-- Création du bucket dish-photos pour les photos de plats
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dish-photos',
  'dish-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;
