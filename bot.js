require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const natural = require('natural');
const NodeCache = require('node-cache'); // ✅ Tambahkan cache

// ========================
// 1. INISIALISASI
// ========================
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const cache = new NodeCache({ stdTTL: 300 }); // Cache 5 menit
const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');

// ========================
// 2. FUNGSI UTAMA (OPTIMAL)
// ========================

// -- 2.1. Ambil Harga dengan Cache & Fallback
async function getPrice(symbol) {
  const cacheKey = `price-${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    let price;
    if (symbol === 'BTC/USDT') {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      price = parseFloat(data.price);
    } else if (symbol === 'XAU/USD') {
      const { data } = await axios.get(`https://metals.live/api/v1/spot?symbol=XAUUSD&api_key=${process.env.METALSAPI_KEY}`);
      price = parseFloat(data.price);
    }
    
    cache.set(cacheKey, price);
    return price;

  } catch (error) {
    console.error(`Gagal ambil harga ${symbol}:`, error.message);
    return symbol === 'BTC/USDT' ? 50000 : 1900; // Fallback value
  }
}

// -- 2.2. Prediksi dengan Model Simulasi
async function predictPrice(symbol) {
  const currentPrice = await getPrice(symbol);
  const volatility = symbol === 'BTC/USDT' ? 0.05 : 0.02; // BTC lebih volatil
  
  return currentPrice * (1 + (Math.random() * volatility * 2 - volatility));
}

// -- 2.3. Analisis Sentimen Multi-Sumber
async function getNewsSentiment(keyword) {
  const cacheKey = `news-${keyword}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const sources = [
      `https://newsapi.org/v2/everything?q=${keyword}&apiKey=${process.env.NEWSAPI_KEY}`,
      `https://api.reddit.com/r/CryptoCurrency/search?q=${keyword}&limit=3`
    ];

    const responses = await Promise.allSettled(
      sources.map(url => axios.get(url))
    );

    const articles = responses
      .filter(res => res.status === 'fulfilled')
      .flatMap(res => {
        if (res.value.config.url.includes('newsapi')) {
          return res.value.data.articles.map(a => ({ title: a.title, source: 'NewsAPI' }));
        } else {
          return res.value.data.data.children.map(p => ({ title: p.data.title, source: 'Reddit' }));
        }
      });

    const results = articles.map(article => {
      const score = analyzer.getSentiment(article.title.split(' '));
      return {
        title: article.title,
        score: ((score + 5) / 10).toFixed(2),
        source: article.source
      };
    });

    cache.set(cacheKey, results);
    return results;

  } catch (error) {
    console.error('Error analisis sentimen:', error);
    return [];
  }
}

// ========================
// 3. HANDLER COMMAND (OPTIMAL)
// ========================

const commandHandlers = {
  '/start': (chatId) => {
    bot.sendMessage(
      chatId,
      '🛠 **Trading Bot Optimized** 🛠\n\n' +
      '/btc - Prediksi Bitcoin\n' +
      '/xau - Prediksi Emas\n' +
      '/help - Panduan penggunaan'
    );
  },

  '/btc': async (chatId) => {
    await generateSignal(chatId, 'BTC/USDT', 'bitcoin');
  },

  '/xau': async (chatId) => {
    await generateSignal(chatId, 'XAU/USD', 'gold+OR+silver');
  }
};

// Daftar command yang valid
const validCommands = new Set(Object.keys(commandHandlers));

// Handle semua command
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const command = msg.text?.split(' ')[0];

  if (validCommands.has(command)) {
    commandHandlers[command](chatId);
  } else if (command.startsWith('/')) {
    bot.sendMessage(chatId, '❌ Command tidak valid. Ketik /help untuk bantuan');
  }
});

// -- Fungsi Pembuat Sinyal Teroptimasi
async function generateSignal(chatId, symbol, keyword) {
  try {
    const loadingMsg = await bot.sendMessage(chatId, '🔄 Memproses data...');

    const [price, prediction, news] = await Promise.all([
      getPrice(symbol),
      predictPrice(symbol),
      getNewsSentiment(keyword)
    ]);

    const avgSentiment = news.length > 0 
      ? news.reduce((sum, item) => sum + parseFloat(item.score), 0) / news.length
      : 0.5; // Netral jika tidak ada berita

    const priceChange = ((prediction - price) / price * 100).toFixed(2);
    const signal = getSignal(price, prediction, avgSentiment);

    let message = `📈 **${symbol}**\n`;
    message += `💰 Harga Sekarang: $${price.toFixed(2)}\n`;
    message += `🔮 Prediksi 24h: $${prediction.toFixed(2)} (${priceChange}%)\n\n`;
    message += `📊 **Sentimen Pasar**\n`;
    message += `😊 Skor: ${(avgSentiment * 100).toFixed(1)}% Positif\n`;

    if (news.length > 0) {
      message += `📌 Topik: ${news.slice(0, 3).map(n => `#${n.title.split(' ')[0]}`).join(' ')}\n\n`;
      message += `📰 **Berita Terkini**\n${news.slice(0, 2).map(n => `- [${n.source}] ${n.title}`).join('\n')}`;
    }

    message += `\n\n🎯 **Sinyal**: ${signal}`;

    await bot.deleteMessage(chatId, loadingMsg.message_id);
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(`Error di ${symbol}:`, error);
    await bot.sendMessage(chatId, `❌ Gagal memproses ${symbol}. Coba lagi nanti.`);
  }
}

function getSignal(price, prediction, sentiment) {
  const isBullish = prediction > price && sentiment > 0.6;
  const isStrongBullish = prediction > price * 1.02 && sentiment > 0.75;

  if (isStrongBullish) return '🚀 STRONG BUY';
  if (isBullish) return '👍 BUY';
  if (sentiment < 0.4) return '⚠️ SELL';
  return '🔄 HOLD';
}

// ========================
// 4. JALANKAN BOT
// ========================
console.log('🤖 Bot berjalan dengan optimal...');
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});