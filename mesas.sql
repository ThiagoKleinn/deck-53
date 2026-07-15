-- ============================================================
-- Deck 53 · schema mesas/comanda
-- ============================================================

-- Novas colunas em sales (usadas no fechamento da comanda)
alter table sales add column if not exists mesa text;
alter table sales add column if not exists payment_method text;

-- Tabela de mesas
create table if not exists tables (
                                      id uuid primary key,
                                      user_id uuid references auth.users not null,
                                      nome text not null,
                                      ordem integer not null default 0,
                                      created_at timestamptz not null default now()
    );

-- Itens da comanda (ligados a uma mesa)
create table if not exists table_items (
                                           id uuid primary key,
                                           user_id uuid references auth.users not null,
                                           table_id uuid references tables(id) on delete cascade not null,
    produto_id uuid references products(id) on delete set null,
    nome text not null,
    quantidade integer not null,
    preco_unit numeric not null,
    total numeric not null,
    created_at timestamptz not null default now()
    );

alter table tables enable row level security;
alter table table_items enable row level security;

create policy "select own tables" on tables for select using (auth.uid() = user_id);
create policy "insert own tables" on tables for insert with check (auth.uid() = user_id);
create policy "update own tables" on tables for update using (auth.uid() = user_id);
create policy "delete own tables" on tables for delete using (auth.uid() = user_id);

create policy "select own table_items" on table_items for select using (auth.uid() = user_id);
create policy "insert own table_items" on table_items for insert with check (auth.uid() = user_id);
create policy "update own table_items" on table_items for update using (auth.uid() = user_id);
create policy "delete own table_items" on table_items for delete using (auth.uid() = user_id);

-- índice útil para buscar itens de uma mesa rapidamente
create index if not exists table_items_table_id_idx on table_items(table_id);