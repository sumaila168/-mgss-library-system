create type public.app_role as enum ('admin', 'librarian');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can read their own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

create policy "Admins can manage roles"
on public.user_roles for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Staff can read all profiles"
on public.profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated using (auth.uid() = id);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  isbn text,
  category text not null default 'General',
  total_copies int not null default 1 check (total_copies >= 0),
  available_copies int not null default 1 check (available_copies >= 0),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.books to authenticated;
grant all on public.books to service_role;
alter table public.books enable row level security;

create policy "Staff can read books"
on public.books for select to authenticated using (true);

create policy "Staff can add books"
on public.books for insert to authenticated with check (true);

create policy "Staff can update books"
on public.books for update to authenticated using (true);

create policy "Admins can delete books"
on public.books for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  class_name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;

create policy "Staff can read students"
on public.students for select to authenticated using (true);

create policy "Staff can add students"
on public.students for insert to authenticated with check (true);

create policy "Staff can update students"
on public.students for update to authenticated using (true);

create policy "Admins can delete students"
on public.students for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  due_date date not null,
  returned_at timestamptz
);
grant select, insert, update, delete on public.loans to authenticated;
grant all on public.loans to service_role;
alter table public.loans enable row level security;

create policy "Staff can read loans"
on public.loans for select to authenticated using (true);

create policy "Staff can issue loans"
on public.loans for insert to authenticated with check (true);

create policy "Staff can update loans"
on public.loans for update to authenticated using (true);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;

create policy "Staff can read activity"
on public.activity_log for select to authenticated using (true);

create policy "Staff can log activity"
on public.activity_log for insert to authenticated with check (true);

insert into public.books (title, author, isbn, category, total_copies, available_copies) values
  ('Things Fall Apart', 'Chinua Achebe', '9780385474542', 'Literature', 6, 6),
  ('The River Between', 'Ngugi wa Thiong''o', '9780435905484', 'Literature', 4, 4),
  ('New General Mathematics 1', 'J.B. Channon', '9780582318434', 'Mathematics', 20, 20),
  ('Integrated Science for Malawi', 'M. Phiri', '9789990812345', 'Science', 15, 15),
  ('Certificate Geography', 'H. Msonthi', '9789990876543', 'Geography', 10, 10),
  ('English in Use', 'A. Banda', '9780194334567', 'English', 12, 12),
  ('Chichewa Malembe', 'S. Kumwenda', '9789990843217', 'Chichewa', 8, 8),
  ('Biology for Secondary Schools', 'T. Nyasulu', '9780582098765', 'Science', 10, 10),
  ('A History of Malawi', 'J. McCracken', '9789990811222', 'History', 5, 5),
  ('Agriculture Today', 'P. Chirwa', '9789990855666', 'Agriculture', 7, 7);

insert into public.students (admission_no, full_name, class_name) values
  ('MGSS-2026-001', 'Chikondi Banda', 'Form 1A'),
  ('MGSS-2026-002', 'Tiwonge Mphande', 'Form 1A'),
  ('MGSS-2026-003', 'Blessings Nyirenda', 'Form 2B'),
  ('MGSS-2026-004', 'Yamikani Chirwa', 'Form 2B'),
  ('MGSS-2026-005', 'Natasha Gondwe', 'Form 3A'),
  ('MGSS-2026-006', 'Dalitso Mbewe', 'Form 3A'),
  ('MGSS-2026-007', 'Memory Kaunda', 'Form 4C'),
  ('MGSS-2026-008', 'Peter Msiska', 'Form 4C');