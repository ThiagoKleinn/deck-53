-- ============================================================
-- Deck 53 · seed.sql
-- Cópia de segurança do cardápio completo. Pode ser rodado
-- quantas vezes quiser: usa ON CONFLICT para atualizar o preço
-- em vez de duplicar, graças à trava única (user_id, nome, categoria).
--
-- PRÉ-REQUISITO (rodar uma única vez, se ainda não rodou):
--   alter table products
--     add constraint products_user_nome_categoria_key
--     unique (user_id, nome, categoria);
--
-- USO:
-- 1. Troque 'EMAIL_DO_DONO_AQUI' pelo e-mail de login do app
-- 2. Rode este script inteiro no SQL Editor do Supabase
-- ============================================================
with owner as (
    select id from auth.users where email = 'EMAIL_DO_DONO_AQUI' limit 1
    )
insert into products (id, user_id, nome, categoria, preco)
select gen_random_uuid(), owner.id, v.nome, v.categoria, v.preco
from owner, (values

                 -- CERVEJAS 600ML
                 ('Heineken', 'Cervejas 600ml', 15.00),
                 ('Eisenbahn', 'Cervejas 600ml', 11.00),
                 ('Petra', 'Cervejas 600ml', 10.00),
                 ('Original', 'Cervejas 600ml', 12.00),
                 ('Brahma Duplo Malte', 'Cervejas 600ml', 11.00),

                 -- CERVEJAS LONGNECKS
                 ('Corona', 'Cervejas Longnecks', 10.00),
                 ('Heineken', 'Cervejas Longnecks', 10.00),
                 ('Budweiser', 'Cervejas Longnecks', 10.00),

                 -- CHOPP
                 ('Stempel 600ml', 'Chopp', 16.00),
                 -- Pilsen e Vinho seguem sem preço definido no cardápio original.
                 -- Descomente e preencha quando tiver o valor:
                 -- ('Pilsen', 'Chopp', 0.00),
                 -- ('Vinho', 'Chopp', 0.00),

                 -- SUCOS NATURAIS
                 ('Suco de Laranja', 'Sucos Naturais', 7.00),
                 ('Suco de Laranja com Morango', 'Sucos Naturais', 9.00),
                 ('Suco de Beterraba com Limão', 'Sucos Naturais', 7.00),
                 ('Suco de Abacaxi com Hortelã', 'Sucos Naturais', 7.00),
                 ('Suco de Morango com Amora', 'Sucos Naturais', 8.00),

                 -- DRINKS (Cocktails)
                 ('Caip Cachaça', 'Drinks', 10.00),
                 ('Caip Vodka', 'Drinks', 12.00),
                 ('Caip Morango', 'Drinks', 14.00),
                 ('Gin', 'Drinks', 28.00),
                 ('Sputnik', 'Drinks', 10.00),

                 -- SHOTS
                 ('Cachaça', 'Shots', 4.00),
                 ('Whisky', 'Shots', 20.00),
                 ('Whisky 12 anos', 'Shots', 26.00),
                 ('Vodka', 'Shots', 10.00),
                 ('Tequila José Cuervo Ouro', 'Shots', 22.00),
                 ('Tequila Ouro', 'Shots', 10.00),

                 -- HAMBURGUER
                 ('Deck Burguer', 'Hamburguer', 27.90),

                 -- PASTEL ESPECIAL
                 ('Pastel de Camarão', 'Pastel Especial', 9.00),

                 -- PASTEL TRADICIONAL
                 ('Pastel de Queijo', 'Pastel Tradicional', 7.00),
                 ('Pastel de Carne', 'Pastel Tradicional', 7.00),
                 ('Pastel de Pizza', 'Pastel Tradicional', 7.00),

                 -- PIZZA ESPECIAL (GRANDE) — R$66,90
                 ('Atum (Grande)', 'Pizza Especial', 66.90),
                 ('Bacon (Grande)', 'Pizza Especial', 66.90),
                 ('Canadense (Grande)', 'Pizza Especial', 66.90),
                 ('Quatro Queijos (Grande)', 'Pizza Especial', 66.90),
                 ('Portuguesa (Grande)', 'Pizza Especial', 66.90),
                 ('Presidente (Grande)', 'Pizza Especial', 66.90),
                 ('Vegetariana (Grande)', 'Pizza Especial', 66.90),

                 -- PIZZA ESPECIAL (FAMÍLIA) — R$73,90
                 ('Atum (Família)', 'Pizza Especial', 73.90),
                 ('Bacon (Família)', 'Pizza Especial', 73.90),
                 ('Canadense (Família)', 'Pizza Especial', 73.90),
                 ('Quatro Queijos (Família)', 'Pizza Especial', 73.90),
                 ('Portuguesa (Família)', 'Pizza Especial', 73.90),
                 ('Presidente (Família)', 'Pizza Especial', 73.90),
                 ('Vegetariana (Família)', 'Pizza Especial', 73.90),

                 -- PIZZA TRADICIONAL (GRANDE) — R$63,90
                 ('Frango com Catupiry (Grande)', 'Pizza Tradicional', 63.90),
                 ('Marguerita (Grande)', 'Pizza Tradicional', 63.90),
                 ('Calabresa (Grande)', 'Pizza Tradicional', 63.90),
                 ('Napolitana (Grande)', 'Pizza Tradicional', 63.90),
                 ('Mussarela (Grande)', 'Pizza Tradicional', 63.90),
                 ('Catupiry (Grande)', 'Pizza Tradicional', 63.90),

                 -- PIZZA TRADICIONAL (FAMÍLIA) — R$69,90
                 ('Frango com Catupiry (Família)', 'Pizza Tradicional', 69.90),
                 ('Marguerita (Família)', 'Pizza Tradicional', 69.90),
                 ('Calabresa (Família)', 'Pizza Tradicional', 69.90),
                 ('Napolitana (Família)', 'Pizza Tradicional', 69.90),
                 ('Mussarela (Família)', 'Pizza Tradicional', 69.90),
                 ('Catupiry (Família)', 'Pizza Tradicional', 69.90),

                 -- PORÇÕES
                 ('Anéis de cebola', 'Porções', 28.00),
                 ('Batata frita', 'Porções', 28.00),
                 ('Batata frita com Cheddar e Bacon', 'Porções', 34.00),
                 ('Linguiça com Mandioca', 'Porções', 34.00),
                 ('Filé de Tilápia', 'Porções', 40.00),
                 ('Trio Mineiro', 'Porções', 38.00),
                 ('Mini Pastéis', 'Porções', 30.00),
                 ('Filé Mignon com Fritas', 'Porções', 72.00),
                 ('Quibe Frito', 'Porções', 28.00)

) as v(nome, categoria, preco)
    on conflict (user_id, nome, categoria)
do update set preco = excluded.preco;