# Orçamento de PC – Coleta automática de preços

Aplicação para montar orçamentos de PC a partir de URLs de produtos (Kabum, Pichau e outros). O backend tenta capturar automaticamente preço à vista e total parcelado e o frontend soma tudo por quantidade.

## Requisitos
- Node.js 18 ou superior

## Como executar
No Windows PowerShell:

```powershell
cd C:\\Users\\ghost\\Desktop\\test
npm install
npm run dev
```

Depois acesse `http://localhost:3000` no navegador.

## Como usar
- Preencha opcionalmente o nome do item, cole a URL do produto e informe a quantidade.
- Clique em “Adicionar”. O sistema buscará os preços e exibirá:
  - **À vista** (se encontrado ou inferido)
  - **Parcelado** (total, se for identificado o padrão de parcelas, exemplo “12x de R$ 199,90”)
- O total geral (à vista e parcelado) é atualizado automaticamente.
- Use “Exportar JSON” para salvar sua lista e “Importar JSON” para carregar novamente.

## Limitações e observações
- Alguns sites bloqueiam scraping via CORS no navegador, por isso a coleta é feita no backend (Node). Ainda assim, páginas que dependem de JavaScript para renderizar preço podem falhar.
- O coletor tenta três estratégias:
  1) JSON-LD do tipo `Product` (campo `offers.price`),
  2) Metatags comuns (ex.: `product:price:amount`, `itemprop=price`),
  3) Padrão de texto para parcelas (ex.: `12x de R$ 199,90`) para estimar o total parcelado.
- Se apenas um preço for encontrado, o outro pode ser inferido:
  - **À vista**: 5% de desconto sobre o parcelado (fallback conservador).
  - **Parcelado**: assume igual ao à vista se não houver informação.
- Para maior precisão, sempre confira os preços no site de origem antes de fechar a compra.

## Deploy na Vercel

### Via CLI (recomendado)
1. Instale a Vercel CLI: `npm i -g vercel`
2. No diretório do projeto, execute:
   ```bash
   vercel
   ```
3. Siga as instruções (primeira vez) ou use `vercel --prod` para produção

### Via GitHub
1. Faça push do código para seu repositório
2. Acesse [vercel.com](https://vercel.com)
3. Importe o repositório
4. A Vercel detecta automaticamente a configuração (`vercel.json`)
5. Deploy automático a cada push

### Estrutura de API
- `api/price.js`: função serverless para `/api/price` (deploy na Vercel)
- `server/index.js`: servidor Express para desenvolvimento local
- `server/scrape.js`: lógica de scraping (Kabum, Pichau, Mercado Livre e genérico)
- `public/`: arquivos estáticos do frontend

## Estrutura
- `api/price.js`: função serverless para Vercel
- `server/index.js`: servidor Express local
- `server/scrape.js`: lógica de scraping (Kabum, Pichau, Mercado Livre e genérico)
- `public/index.html` e `public/main.js`: interface web
- `vercel.json`: configuração de deploy

## Funcionalidades
- Coleta automática de preços de múltiplas lojas
- Cache local (localStorage) para evitar requisições repetidas
- Categorias e totais por categoria
- Exportar/Importar JSON e CSV
- Compartilhar orçamento via link
- Edição manual de preços
- Duplicar itens
- Histórico local de preços


