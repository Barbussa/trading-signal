require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { SMA, RSI } = require('technicalindicators');

// Setup Bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Data Simulasi (Ganti dengan API nyata jika perlu)
const mockData = {
  btc: { price: 50123.45, rsi: 62, trend: 'up' },
  xau: { price: 1890.50, rsi: 58, trend: 'sideways' }
};

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

// Analisis Pasar
async function analyzeMarket(symbol) {
  // Jika pakai API nyata:
  // const { data } = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  
  // Contoh dengan data simulasi
  const data = symbol === 'btc' ? mockData.btc : mockData.xau;
  
  // Generate signal
  let signal = '🔄 TUNGGU';
  if (data.rsi < 30 && data.trend === 'up') signal = '🚀 BELI';
  if (data.rsi > 70 && data.trend === 'down') signal = '⚠️ JUAL';

  return {
    price: data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    rsi: data.rsi,
    signal
  };
}

// Handler Command
bot.onText(/\/btc/, async (msg) => {
  const { price, rsi, signal } = await analyzeMarket('btc');
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

bot.onText(/\/xau/, async (msg) => {
  const { price, rsi, signal } = await analyzeMarket('xau');
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
