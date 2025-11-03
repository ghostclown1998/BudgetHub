const cheerio = require('cheerio');
const { URL } = require('url');

function parsePriceToNumber(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeCurrency(price) {
  if (price == null) return null;
  return Math.round(Number(price) * 100) / 100;
}

function adjustPossibleCents(value) {
  if (value == null) return null;
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n) && n > 1000 && n <= 500000) {
    n = n / 100;
  }
  return normalizeCurrency(n);
}

async function fetchHtml(targetUrl) {
  const resp = await fetch(targetUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'upgrade-insecure-requests': '1'
    },
    redirect: 'follow'
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  return html;
}

function extractJsonLdProduct($) {
  const scripts = Array.from($('script[type="application/ld+json"]').toArray());
  for (const script of scripts) {
    try {
      const json = JSON.parse($(script).text());
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const type = node['@type'] || (node['@graph'] && node['@graph'][0] && node['@graph'][0]['@type']);
        if (type && (String(type).toLowerCase().includes('product') || (Array.isArray(type) && type.includes('Product')))) {
          const product = node['@type'] ? node : (node['@graph'] ? node['@graph'].find(n => n['@type'] === 'Product') : null);
          if (product) return product;
        }
      }
    } catch (_) {
    }
  }
  return null;
}

function extractMetaPrice($) {
  const ogPrice = $('meta[property="product:price:amount"]').attr('content')
    || $('meta[itemprop="price"]').attr('content')
    || $('meta[property="og:price:amount"]').attr('content');
  return ogPrice ? parsePriceToNumber(ogPrice) : null;
}

function guessInstallments($) {
  const bodyText = $('body').text();
  const regex = /(\d{1,2})\s*[xX]\s*(?:de)?\s*R\$\s*([0-9\.,]+)/;
  const m = bodyText.match(regex);
  if (m) {
    const qty = parseInt(m[1], 10);
    const each = parsePriceToNumber(m[2]);
    if (qty > 1 && each) {
      return normalizeCurrency(qty * each);
    }
  }
  return null;
}

function priceNearKeywords($) {
  const text = $('body').text();
  const vistaRegex = /(à\s*vista|no\s*pix|boleto)[^\n]{0,80}?R\$\s*([0-9\.,]+)/i;
  const m = text.match(vistaRegex);
  if (m) {
    const val = parsePriceToNumber(m[2]);
    if (val) return normalizeCurrency(val);
  }
  return null;
}

function pixPriceFromContext($) {
  const text = $('body').text().replace(/\s+/g, ' ');
  const patterns = [
    /(no\s*pix|pix)[^\n]{0,60}?R\$\s*([0-9\.,]+)/i,
    /(pix\s*com\s*\d{1,2}%\s*desconto)[^\n]{0,60}?R\$\s*([0-9\.,]+)/i,
    /(à\s*vista)[^\n]{0,60}?R\$\s*([0-9\.,]+)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const val = parsePriceToNumber(m[2] || m[1]);
      if (val) return normalizeCurrency(val);
    }
  }
  return null;
}

function extractAllBRL($) {
  const text = $('body').text();
  const regex = /R\$\s*([0-9\.]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+,[0-9]{2})/g;
  const values = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const v = parsePriceToNumber(m[1]);
    if (v && v > 1) values.push(v);
  }
  const uniq = Array.from(new Set(values.map(v => normalizeCurrency(v))));
  return uniq.sort((a, b) => a - b);
}

function extractNextData($) {
  const el = $('script#__NEXT_DATA__').first();
  if (!el || el.length === 0) return null;
  try {
    const json = JSON.parse(el.text());
    return json || null;
  } catch (_) {
    return null;
  }
}

function collectNumbersFromKeys(node, keysLower) {
  const found = [];
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur)) {
        const kl = String(k).toLowerCase();
        if (keysLower.includes(kl)) {
          let n = null;
          if (typeof v === 'string') n = parsePriceToNumber(v);
          else if (typeof v === 'number') n = v;
          if (n && Number.isFinite(n)) {
            if (n > 1000 && Number.isInteger(n) && n <= 500000) {
              n = n / 100;
            }
            if (n > 0.05) found.push(normalizeCurrency(n));
          }
        }
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return found;
}

function extractInstallmentsFromTree(node) {
  const candidates = [];
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    if (Array.isArray(cur)) {
      for (const it of cur) stack.push(it);
      continue;
    }
    const keys = Object.keys(cur).map(k => k.toLowerCase());
    if (keys.includes('quantity') && (keys.includes('value') || keys.includes('amount'))) {
      const qty = parseInt(cur.quantity, 10);
      let val = cur.value ?? cur.amount;
      if (typeof val === 'string') val = parsePriceToNumber(val);
      if (typeof val === 'number' && val > 1000 && Number.isInteger(val) && val <= 500000) {
        val = val / 100;
      }
      if (qty > 1 && val) candidates.push(normalizeCurrency(qty * val));
    }
    for (const v of Object.values(cur)) stack.push(v);
  }
  if (candidates.length) return Math.max(...candidates);
  return null;
}

function titleFromPage($) {
  const t = $('meta[property="og:title"]').attr('content') || $('title').text();
  return t ? t.trim() : null;
}

function siteSpecificExtractors(hostname) {
  const host = hostname.replace(/^www\./, '');
  return {
    isKabum: host.includes('kabum.com.br'),
    isPichau: host.includes('pichau.com.br'),
    isMercadoLivre: host.includes('mercadolivre.com.br')
  };
}

function kabumExtractor($) {

  const product = extractJsonLdProduct($);
  let price = null;
  if (product && product.offers) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    price = parsePriceToNumber(offers.price || offers.lowPrice || offers.highPrice);
  }
  if (!price) price = extractMetaPrice($);
  if (!price) price = pixPriceFromContext($) || priceNearKeywords($);
  if (price) price = adjustPossibleCents(price);

  let parceladoTotal = guessInstallments($);
  if (!parceladoTotal) {
    const all = extractAllBRL($);
    if (all.length >= 2) parceladoTotal = all[all.length - 1];
  }
  if (parceladoTotal) parceladoTotal = adjustPossibleCents(parceladoTotal);
  return { priceVista: price ? normalizeCurrency(price) : null, priceParcelado: parceladoTotal || null };
}

function mercadoLivreExtractor($) {
  const product = extractJsonLdProduct($);
  let price = null;
  let parceladoTotal = null;

  const bodyText = $('body').text();
  
  const pixPatterns = [
    /R\$\s*([0-9]{1,2}(?:\.[0-9]{3})*(?:,[0-9]{2})?)[^0-9]*(?:no\s+Pix|Pix|pix)/i,
    /([0-9]{1,2}(?:\.[0-9]{3})*)\s*(?:no\s+Pix|Pix|pix)/i,
    /(?:no\s+Pix|Pix|pix)[^R]*R\$\s*([0-9]{1,2}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/i
  ];
  for (const pattern of pixPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      const p = parsePriceToNumber(match[1]);
      if (p && p >= 500) {
        price = p;
        break;
      }
    }
  }
  
  const parcelMatch = bodyText.match(/(?:em|até)\s*(\d{1,2})x[^R]*R\$\s*([0-9\.,]+)[^R]*(?:sem juros|juros)/i);
  if (parcelMatch) {
    const qty = parseInt(parcelMatch[1], 10);
    const each = parsePriceToNumber(parcelMatch[2]);
    if (qty > 1 && each) {
      parceladoTotal = qty * each;
    }
  }
  
  if (!price && product && product.offers) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const mainPrice = parsePriceToNumber(offers.price || offers.lowPrice);
    if (mainPrice && mainPrice >= 100) {
      price = mainPrice;
    }
    if (offers.highPrice && !parceladoTotal) {
      const hp = parsePriceToNumber(offers.highPrice);
      if (hp && hp > (price || 0) * 1.05) {
        parceladoTotal = hp;
      }
    }
  }

  if (!price) {
    const priceSelectors = [
      '[data-testid="price"]',
      '.ui-pdp-price__second-line .andes-money-amount__fraction',
      '.andes-money-amount--cents-superscript + .andes-money-amount__fraction',
      '.ui-pdp-price .andes-money-amount__fraction'
    ];
    for (const sel of priceSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const txt = el.text().trim();
        const p = parsePriceToNumber(txt);
        if (p && p > 100) {
          price = p;
          break;
        }
      }
    }
  }

  if (!parceladoTotal) parceladoTotal = guessInstallments($);

  if (!price || !parceladoTotal) {
    const all = extractAllBRL($);
    const filtered = all.filter(v => v >= 500 && v <= 50000);
    if (filtered.length > 0) {
      if (!price) price = filtered[0];
      if (!parceladoTotal && filtered.length >= 2) {
        parceladoTotal = filtered[filtered.length - 1];
      }
    }
  }

  price = price ? normalizeCurrency(price) : null;
  parceladoTotal = parceladoTotal ? normalizeCurrency(parceladoTotal) : null;

  return { priceVista: price, priceParcelado: parceladoTotal };
}

function pichauExtractor($) {
  const product = extractJsonLdProduct($);
  let price = null;
  if (product && product.offers) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    price = parsePriceToNumber(offers.price || offers.lowPrice || offers.highPrice);
  }
  if (!price) price = extractMetaPrice($);
  if (!price) price = pixPriceFromContext($) || priceNearKeywords($);
  if (price) price = adjustPossibleCents(price);

  if (!price) {
    const nextData = extractNextData($);
    if (nextData) {
      const keysVista = [
        'pix','pixprice','pix_price','pricepix','cash','cashprice','cash_price','price_cash',
        'pricewithdiscount','price_with_discount','value_with_discount','promotionalprice','promotional_price',
        'price','saleprice','lowprice'
      ];
      const numbers = collectNumbersFromKeys(nextData, keysVista);
      if (numbers.length) price = Math.min(...numbers.filter(n => n > 1));
    }
  }

  let parceladoTotal = guessInstallments($);
  if (!parceladoTotal) {
    const nextData = extractNextData($);
    if (nextData) parceladoTotal = extractInstallmentsFromTree(nextData) || null;
  }
  if (!parceladoTotal) {
    const all = extractAllBRL($);
    if (all.length >= 2) parceladoTotal = all[all.length - 1];
  }
  if (parceladoTotal) parceladoTotal = adjustPossibleCents(parceladoTotal);
  return { priceVista: price ? normalizeCurrency(price) : null, priceParcelado: parceladoTotal || null };
}

function genericExtractor($) {
  const product = extractJsonLdProduct($);
  const name = product && (product.name || product.title);
  let price = null;
  if (product && product.offers) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    price = parsePriceToNumber(offers.price || offers.lowPrice || offers.highPrice);
  }
  if (!price) price = extractMetaPrice($);
  if (!price) price = priceNearKeywords($);
  if (!price) {
    const all = extractAllBRL($);
    if (all.length) price = all[0];
  }
  if (price) price = adjustPossibleCents(price);
  const parceladoTotal = guessInstallments($);
  return {
    title: name || null,
    priceVista: price ? normalizeCurrency(price) : null,
    priceParcelado: parceladoTotal || null
  };
}

async function scrapeProduct(targetUrl) {
  const u = new URL(targetUrl);
  const html = await fetchHtml(targetUrl);
  const $ = cheerio.load(html);

  const title = titleFromPage($);
  const { isKabum, isPichau, isMercadoLivre } = siteSpecificExtractors(u.hostname);

  let extracted;
  if (isKabum) extracted = kabumExtractor($);
  else if (isPichau) extracted = pichauExtractor($);
  else if (isMercadoLivre) extracted = mercadoLivreExtractor($);
  else extracted = genericExtractor($);

  const result = {
    url: targetUrl,
    title: extracted.title || title || null,
    priceVista: extracted.priceVista || null,
    priceParcelado: extracted.priceParcelado || null,
    source: {
      hostname: u.hostname,
      strategy: isKabum ? 'kabum' : isPichau ? 'pichau' : isMercadoLivre ? 'mercadolivre' : 'generic'
    }
  };

  if (result.priceVista == null && result.priceParcelado != null) {
    result.priceVista = normalizeCurrency(result.priceParcelado * 0.95);
    result.source.inferred = 'vista_from_parcelado_5pct_discount';
  }
  if (result.priceParcelado == null && result.priceVista != null) {
    result.priceParcelado = result.priceVista;
    result.source.inferred = 'parcelado_equals_vista_fallback';
  }

  return result;
}

module.exports = { scrapeProduct };


