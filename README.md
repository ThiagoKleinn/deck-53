# Deck 53 — Painel do Dono

App de controle de vendas e faturamento. Funciona offline, tem ícone
próprio (pode ser instalado na tela inicial do celular) e sincroniza os
dados na nuvem via Supabase, acessível de qualquer aparelho com login.

## Instalar como app no celular

Depois de publicado, abra o link no celular e:

- **Android/Chrome**: menu (⋮) → "Adicionar à tela inicial" / "Instalar app"
- **iPhone/Safari**: botão de compartilhar → "Adicionar à Tela de Início"

O ícone "Deck 53" vai aparecer na tela como um app normal, abre em tela
cheia (sem barra de navegador) e continua funcionando mesmo sem internet
— as vendas feitas offline entram numa fila e sincronizam sozinhas assim
que a conexão voltar (dá pra ver isso pelo indicador no topo do app).

## Criar a conta de acesso

Na primeira vez, abra o app com internet e usa a aba
**"Criar conta"** (e-mail + senha). Depois disso, pode entrar
("Entrar") de qualquer aparelho com esse mesmo login.

## Estrutura dos arquivos

```
deck53/
├── index.html          → tela de login + estrutura do app
├── manifest.json        → configuração do PWA (ícone, nome)
├── sw.js                → service worker (cache offline)
├── schema.sql            → script para criar as tabelas no Supabase
├── css/styles.css
├── js/
│   ├── config.js         → suas credenciais do Supabase (editar aqui)
│   ├── supabaseClient.js → chamadas de login/API ao Supabase
│   ├── db.js             → cache local + fila de sincronização offline
│   └── app.js             → toda a lógica de tela (estoque, vendas, painel)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
