require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const ccxt = require('ccxt');
const { RSI } = require('technicalindicators');

// Setup Bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Initialize exchange
const exchange = new ccxt.binance();

// Market data cache
const marketData = {
  btc: { price: 0, rsi: 0, trend: 'sideways' },
  xau: { price: 0, rsi: 0, trend: 'sideways' }
};

// Function to get real-time data with RSI
async function getRealTimeData(symbol, pair) {
  try {
    const candles = await exchange.fetchOHLCV(symbol, '15m', undefined, 14);
    const closes = candles.map(c => c[4]);
    const rsi = RSI.calculate({ values: closes, period: 14 }).pop();
    const currentPrice = candles[candles.length - 1][4];
    
    // Determine trend
    const trend = currentPrice > candles[candles.length - 2][4] ? 'up' : 'down';
    
    // Update market data
    marketData[pair] = {
      price: currentPrice,
      rsi: Math.round(rsi * 100) / 100,
      trend
    };
    
    console.log(`Updated ${pair} data:`, marketData[pair]);
  } catch (error) {
    console.error(`Error fetching ${pair} data:`, error.message);
  }
}

// Auto-update market data every 30 seconds
async function updateMarketData() {
  await getRealTimeData('BTC/USDT', 'btc');
  await getRealTimeData('XAU/USD', 'xau');
  setTimeout(updateMarketData, 30000);
}

// Initial data fetch
updateMarketData();

// Command /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `💎 *BOT TRADING READY* 💎\n\n` +
    `📌 Fitur:\n` +
    `/btc - Analisis Bitcoin\n` +
    `/xau - Analisis Emas (XAU/USD)\n\n` +
    `🛠 By: @username`,
    { parse_mode: 'Markdown' }
  );
});

// Analyze market function
function analyzeMarket(pair) {
  const data = marketData[pair];
  
  let signal = '🔄 TUNGGU';
  if (data.rsi < 30 && data.trend === 'up') signal = '🚀 BELI';
  if (data.rsi > 70 && data.trend === 'down') signal = '⚠️ JUAL';

  return {
    price: data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    rsi: data.rsi,
    signal
  };
}

// Handler Command /btc
bot.onText(/\/btc/, async (msg) => {
  const { price, rsi, signal } = analyzeMarket('btc');
  bot.sendMessage(
    msg.chat.id,
    `📊 *BITCOIN (BTC/USDT)*\n\n` +
    `💰 Harga: ${price}\n` +
    `📈 RSI(14): ${rsi}\n` +
    `🎯 Sinyal: ${signal}\n\n` +
    `⏱ Update: ${new Date().toLocaleTimeString()}`,
    { parse_mode: 'Markdown' }
  );
});

// Handler Command /xau
bot.onText(/\/xau/, async (msg) => {
  const { price, rsi, signal } = analyzeMarket('xau');
  bot.sendMessage(
    msg.chat.id,
    `📊 *EMAS (XAU/USD)*\n\n` +
    `💰 Harga: ${price}\n` +
    `📈 RSI(14): ${rsi}\n` +
    `🎯 Sinyal: ${signal}\n\n` +
    `⏱ Update: ${new Date().toLocaleTimeString()}`,
    { parse_mode: 'Markdown' }
  );
});

console.log('🤖 Bot aktif! Gunakan /start di Telegram');
