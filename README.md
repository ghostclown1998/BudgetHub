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

## Estrutura
- `server/index.js`: servidor Express, endpoint `GET /api/price?url=...`.
- `server/scrape.js`: lógica de scraping (Kabum, Pichau e genérico).
- `public/index.html` e `public/main.js`: interface web.

## Extensões futuras
- Scrapers específicos mais robustos (Terabyte, Amazon BR, etc.).
- Suporte a edição manual de preços quando a coleta falhar.
- Histórico de variação de preço.


