-- Policies de RLS para o bucket "avatars" (Supabase Storage).
--
-- Contexto: o bucket "avatars" já existe (público, jpeg/png/webp/gif, 5MB) mas
-- nunca teve policies de RLS configuradas em storage.objects. Isso bloqueava
-- qualquer upload real com o erro:
--   {"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}
--
-- Confirmado via teste real de upload (AvatarUploadButton) antes desta migration.

-- 1. Leitura pública — qualquer pessoa pode visualizar as fotos do bucket
--    "avatars" (necessário mesmo com bucket marcado como público, pois RLS
--    em storage.objects continua se aplicando às chamadas via API).
create policy "Public read access for avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- 2. Upload — qualquer usuário autenticado pode enviar novos arquivos para
--    o bucket "avatars".
create policy "Authenticated users can upload avatars"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars');

-- 3. Atualização — qualquer usuário autenticado pode sobrescrever arquivos
--    existentes no bucket "avatars" (necessário pelo upload com upsert:true
--    em uploadAvatar()).
create policy "Authenticated users can update avatars"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');
