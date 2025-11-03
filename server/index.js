const express = require('express');
const cors = require('cors');
const path = require('path');
const { scrapeProduct } = require('./scrape');

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint de scraping de preço
app.get('/api/price', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório' });
  }
  try {
    const result = await scrapeProduct(url);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao coletar dados', details: String(err && err.message ? err.message : err) });
  }
});

// Export para Vercel (serverless)
module.exports = app;

// Para desenvolvimento local
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.use('/', express.static(path.join(__dirname, '..', 'public')));
  app.listen(PORT, () => {
    console.log(`Servidor iniciado em http://localhost:${PORT}`);
  });
}


