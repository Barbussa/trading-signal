require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
const { RSI } = require('technicalindicators');

// Setup Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Market data storage
const marketData = {
  btc: { price: 0, rsi: 0, trend: 'sideways', closes: [] },
  xau: { price: 0, rsi: 0, trend: 'sideways', closes: [] }
};

// Initialize WebSocket connections
const btcWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
const xauWs = new WebSocket('wss://stream.binance.com:9443/ws/xauusdt@ticker');

// Handle BTC/USDT WebSocket
btcWs.on('message', (data) => {
  try {
    const ticker = JSON.parse(data);
    const currentPrice = parseFloat(ticker.c);
    
    // Update price
    marketData.btc.price = currentPrice;
    
    // Update closes array for RSI (last 14 periods)
    marketData.btc.closes.push(currentPrice);
    if (marketData.btc.closes.length > 14) {
      marketData.btc.closes.shift();
    }
    
    // Calculate RSI if we have enough data
    if (marketData.btc.closes.length === 14) {
      marketData.btc.rsi = RSI.calculate({
        values: marketData.btc.closes,
        period: 14
      }).pop();
      
      // Determine trend
      marketData.btc.trend = currentPrice > marketData.btc.closes[12] ? 'up' : 'down';
    }
    
    console.log(`BTC Updated: $${currentPrice} | RSI: ${marketData.btc.rsi}`);
  } catch (error) {
    console.error('BTC WS Error:', error);
  }
});

// Handle XAU/USD WebSocket (Gold)
xauWs.on('message', (data) => {
  try {
    const ticker = JSON.parse(data);
    const currentPrice = parseFloat(ticker.c);
    
    // Update price
    marketData.xau.price = currentPrice;
    
    // Update closes array for RSI
    marketData.xau.closes.push(currentPrice);
    if (marketData.xau.closes.length > 14) {
      marketData.xau.closes.shift();
    }
    
    // Calculate RSI
    if (marketData.xau.closes.length === 14) {
      marketData.xau.rsi = RSI.calculate({
        values: marketData.xau.closes,
        period: 14
      }).pop();
      
      marketData.xau.trend = currentPrice > marketData.xau.closes[12] ? 'up' : 'down';
    }
    
    console.log(`XAU Updated: $${currentPrice} | RSI: ${marketData.xau.rsi}`);
  } catch (error) {
    console.error('XAU WS Error:', error);
  }
});

// Handle WebSocket errors
btcWs.on('error', (error) => console.error('BTC WS Error:', error));
xauWs.on('error', (error) => console.error('XAU WS Error:', error));

// Command handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `💎 *BOT TRADING REAL-TIME* 💎\n\n` +
    `📊 Data langsung dari Binance WebSocket\n` +
    `📌 Perintah:\n` +
    `/btc - Analisis Bitcoin\n` +
    `/xau - Analisis Emas\n\n` +
    `🔄 Update otomatis setiap detik`,
    { parse_mode: 'Markdown' }
  );
});

function getMarketAnalysis(symbol) {
  const data = marketData[symbol];
  let signal = '🔄 TUNGGU';
  
  if (data.rsi < 30 && data.trend === 'up') signal = '🚀 BELI';
  if (data.rsi > 70 && data.trend === 'down') signal = '⚠️ JUAL';
  
  return {
    price: data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    rsi: data.rsi ? data.rsi.toFixed(2) : 'Calculating...',
    signal
  };
}

bot.onText(/\/btc/, (msg) => {
  const { price, rsi, signal } = getMarketAnalysis('btc');
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

bot.onText(/\/xau/, (msg) => {
  const { price, rsi, signal } = getMarketAnalysis('xau');
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
