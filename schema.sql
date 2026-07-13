create table if not exists products (
  id uuid primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  categoria text,
  custo numeric not null default 0,
  venda numeric not null default 0,
  estoque integer not null default 0,
  minimo integer not null default 5,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key,
  user_id uuid references auth.users not null,
  produto_id uuid references products(id) on delete set null,
  nome text not null,
  quantidade integer not null,
  preco_unit numeric not null,
  custo_unit numeric not null,
  total numeric not null,
  lucro numeric not null,
  data timestamptz not null default now()
);

alter table products enable row level security;
alter table sales enable row level security;

create policy "select own products" on products for select using (auth.uid() = user_id);
create policy "insert own products" on products for insert with check (auth.uid() = user_id);
create policy "update own products" on products for update using (auth.uid() = user_id);
create policy "delete own products" on products for delete using (auth.uid() = user_id);

create policy "select own sales" on sales for select using (auth.uid() = user_id);
create policy "insert own sales" on sales for insert with check (auth.uid() = user_id);
create policy "update own sales" on sales for update using (auth.uid() = user_id);
create policy "delete own sales" on sales for delete using (auth.uid() = user_id);