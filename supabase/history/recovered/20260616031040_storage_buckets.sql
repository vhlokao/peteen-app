-- Storage Buckets — TitiodePet
-- avatars: fotos de perfil (tutores, profissionais, parceiros)
-- pets: fotos dos pets
-- documents: documentos de verificação de profissionais (privado)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'pets',
    'pets',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'documents',
    'documents',
    false, -- privado
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- RLS para bucket avatars (público para leitura, restrito para escrita)
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS para bucket pets
CREATE POLICY "pets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pets');

CREATE POLICY "pets: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pets: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pets: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS para bucket documents (privado)
CREATE POLICY "documents: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "documents: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );