-- 1. Tabel Profil Warga Terintegrasi
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    username text unique not null,
    instagram text,
    role text default 'citizen' check (role in ('citizen', 'mayor', 'admin')),
    status text default 'pending' check (status in ('pending', 'approved', 'banned')),
    saldo numeric default 50000,
    energi int default 100,
    gizi int default 100,
    exp int default 0,
    level int default 1,
    job text default 'Pengangguran',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabel Bangunan Kota
create table public.buildings (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    category text not null,
    created_by uuid references public.profiles(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabel Feed Sosial Warga (Aman dari XSS)
create table public.posts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabel Transaksi Bank Virtual
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    sender_id uuid references public.profiles(id),
    receiver_id uuid references public.profiles(id),
    amount numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Aktifkan Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.posts enable row level security;
alter table public.transactions enable row level security;

-- Kebijakan RLS Profiles
create policy "Profil dapat dilihat semua orang" on public.profiles for select using (true);
create policy "Warga dapat mengedit profil sendiri" on public.profiles for update using (auth.uid() = id);
create policy "Wali kota dapat mengedit semua profil" on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'mayor')
);

-- Kebijakan RLS Buildings
create policy "Bangunan dapat dilihat semua orang" on public.buildings for select using (true);
create policy "Hanya Wali Kota dapat menambah bangunan" on public.buildings for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'mayor')
);

-- Kebijakan RLS Posts
create policy "Postingan sosial dapat dilihat semua" on public.posts for select using (true);
create policy "Warga terverifikasi dapat membuat postingan" on public.posts for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
);

-- Fungsi Transaksi Aman (Atomic Transfer)
create or replace function transfer_saldo(recipient_username text, transfer_amount numeric)
returns void as $$
declare
    sender_saldo numeric;
    receiver_id uuid;
begin
    if transfer_amount <= 0 then
        raise exception 'Nominal transfer harus lebih besar dari 0';
    end if;

    select saldo into sender_saldo from public.profiles where id = auth.uid();
    if sender_saldo < transfer_amount then
        raise exception 'Saldo virtual tidak mencukupi';
    end if;

    select id into receiver_id from public.profiles where username = recipient_username;
    if receiver_id is null then
        raise exception 'Penerima tidak ditemukan';
    end if;

    update public.profiles set saldo = saldo - transfer_amount where id = auth.uid();
    update public.profiles set saldo = saldo + transfer_amount where id = receiver_id;

    insert into public.transactions (sender_id, receiver_id, amount) 
    values (auth.uid(), receiver_id, transfer_amount);
end;
$$ language plpgsql security definer;

