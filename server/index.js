const express = require('express');
const cors = require('cors');
const path = require('path');
const { scrapeProduct } = require('./scrape');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir frontend estático
app.use('/', express.static(path.join(__dirname, '..', 'public')));

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

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});


