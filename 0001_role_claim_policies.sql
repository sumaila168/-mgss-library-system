create policy "First user can claim admin"
on public.user_roles for insert to authenticated
with check (
  auth.uid() = user_id
  and role = 'admin'
  and not exists (select 1 from public.user_roles where role = 'admin')
);

create policy "Users can claim librarian role"
on public.user_roles for insert to authenticated
with check (auth.uid() = user_id and role = 'librarian');