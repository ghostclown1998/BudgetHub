const { scrapeProduct } = require('../server/scrape');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Parâmetro url é obrigatório' });
  }
  try {
    const result = await scrapeProduct(url);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ 
      error: 'Falha ao coletar dados', 
      details: String(err && err.message ? err.message : err) 
    });
  }
};

