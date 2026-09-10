# Supabase production schema + RLS for Secure Chat.
# Copy the model used by the local JSON store (server/src/services/*).
# Apply in the Supabase SQL editor after creating the production project.

-- Users table (id is a UUID matching JWT sub claim)
create extension if not exists "pgcrypto";

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    password_hash text not null,
    public_key text not null default '',
    role text not null default 'user' check (role in ('user', 'admin')),
    status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
    two_factor_secret text default null,
    created_at timestamptz not null default now()
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now()
);

-- Participation is explicit so RLS can authorize members only.
create table if not exists public.conversation_members (
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    primary key (conversation_id, user_id)
);

-- Ciphertext only. The server never stores plaintext.
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id uuid not null references public.users(id) on delete cascade,
    ciphertext text not null,
    nonce text not null,
    encrypted_key_reference text not null,
    sender_wrapped_key text not null,
    expires_at timestamptz default null,
    expires_read boolean not null default false,
    destroyed_at timestamptz default null,
    created_at timestamptz not null default now()
);

create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    uploader_id uuid not null references public.users(id) on delete cascade,
    name text not null,
    mime text not null,
    size bigint not null,
    storage_key text not null unique,
    ciphertext text not null,
    wrapped_key text not null,
    expires_at timestamptz default null,
    destroyed_at timestamptz default null,
    created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    action text not null,
    meta jsonb not null default '{}',
    ip varchar(45) not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);
create index if not exists idx_messages_expiry on public.messages(expires_at) where expires_at is not null and destroyed_at is null;
create index if not exists idx_files_expiry on public.files(expires_at) where expires_at is not null and destroyed_at is null;
create index if not exists idx_audit_user on public.audit_logs(user_id, created_at desc);

-- Storage bucket for encrypted file blobs (no public access).
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

-- ============ Row Level Security ============
alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.audit_logs enable row level security;

-- Users may read/update their own row; admins manage all.
drop policy if exists "users read self" on public.users;
create policy "users read self" on public.users
    for select using (auth.uid() = id or (select role from public.users where id = auth.uid()) = 'admin');

drop policy if exists "users update self" on public.users;
create policy "users update self" on public.users
    for update using (auth.uid() = id);

-- Conversations: only members (or admins) see them.
create or replace function public.is_member(cid uuid) returns boolean language sql stable as $$
    select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid())
        or (select role from public.users where id = auth.uid()) = 'admin';
$$;

drop policy if exists "conversations member only" on public.conversations;
create policy "conversations member only" on public.conversations
    for select using (public.is_member(id));

drop policy if exists "members member only" on public.conversation_members;
create policy "members member only" on public.conversation_members
    for select using (public.is_member(conversation_id));

-- Messages: members may read, participants may insert into their own conversations.
drop policy if exists "messages member read" on public.messages;
create policy "messages member read" on public.messages
    for select using (public.is_member(conversation_id));

drop policy if exists "messages participant insert" on public.messages;
create policy "messages participant insert" on public.messages
    for insert with check (public.is_member(conversation_id) and sender_id = auth.uid());

-- Files mirror messages.
drop policy if exists "files member read" on public.files;
create policy "files member read" on public.files
    for select using (public.is_member(conversation_id));

drop policy if exists "files participant insert" on public.files;
create policy "files participant insert" on public.files
    for insert with check (public.is_member(conversation_id) and uploader_id = auth.uid());

-- Audit logs: read by admins only.
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs
    for select using ((select role from public.users where id = auth.uid()) = 'admin');