INSERT INTO public.profiles (id, full_name)
SELECT id, 'MZUGOSS Library' FROM auth.users WHERE email = 'mzugoss@mgss.local'
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email <> 'mzugoss@mgss.local');
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'mzugoss@mgss.local'
ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "first user can claim admin" ON public.user_roles;