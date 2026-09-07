-- Função: sincroniza auth.users → public.users no momento de registro
-- Executada automaticamente pelo Supabase após INSERT em auth.users
-- Gera um cuid-like no lado do banco para o id da aplicação
-- authId = uuid do Supabase (imutável)
-- email = extraído dos metadados do Supabase Auth

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
BEGIN
  -- Gera um ID único compatível com cuid (prefixo 'c' + timestamp + random)
  new_id := 'c' || to_hex(extract(epoch from now())::bigint) || substr(md5(random()::text), 1, 16);

  INSERT INTO public.users (
    id,
    "authId",
    email,
    "createdAt",
    "updatedAt"
  ) VALUES (
    new_id,
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT ("authId") DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: disparado após cada novo usuário criado no Supabase Auth
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Revoga acesso direto à função para usuários não-privilegiados
-- A função só deve ser invocada internamente pelo trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;