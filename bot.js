require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
const { RSI } = require('technicalindicators');
const fetch = require('node-fetch');

// Setup Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Market data storage
const marketData = {
  btc: { price: 0, rsi: 0, trend: 'sideways', closes: [] },
  gold: { price: 0, lastUpdated: null }  // New structure for gold data
};

// Initialize WebSocket connection for BTC
const btcWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');

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

// Function to fetch gold price from GoldAPI
async function getGoldPrice() {
  const myHeaders = new Headers();
  myHeaders.append("x-access-token", process.env.GOLDAPI_TOKEN || "goldapi-5wcsmda5ki4h-io");
  myHeaders.append("Content-Type", "application/json");

  try {
    const response = await fetch("https://www.goldapi.io/api/XAU/USD", {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return {
      price: result.price,
      timestamp: result.timestamp
    };
  } catch (error) {
    console.error('Error fetching gold price:', error);
    return null;
  }
}

// Auto-update gold price
async function updateGoldPrice() {
  const goldData = await getGoldPrice();
  if (goldData) {
    marketData.gold.price = goldData.price;
    marketData.gold.lastUpdated = new Date(goldData.timestamp * 1000);
    console.log(`XAU/USD Updated: $${goldData.price}`);
  } else {
    console.log('Using cached gold data due to API error');
  }
  
  setTimeout(updateGoldPrice, 60000); // Update every 1 minute
}

// Start gold price updates
updateGoldPrice();

// Command handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `💎 *BOT TRADING REAL-TIME* 💎\n\n` +
    `📊 Data Sources:\n` +
    `- BTC/USDT: Binance WebSocket\n` +
    `- XAU/USD: GoldAPI.io\n\n` +
    `📌 Commands:\n` +
    `/btc - Bitcoin Analysis\n` +
    `/gold - Gold Price\n\n` +
    `🔄 Auto-update every minute`,
    { parse_mode: 'Markdown' }
  );
});

// BTC Command
bot.onText(/\/btc/, (msg) => {
  const { price, rsi, signal } = getMarketAnalysis('btc');
  bot.sendMessage(
    msg.chat.id,
    `📊 *BITCOIN (BTC/USDT)*\n\n` +
    `💰 Price: ${price}\n` +
    `📈 RSI(14): ${rsi}\n` +
    `🎯 Signal: ${signal}\n\n` +
    `⏱ Updated: ${new Date().toLocaleTimeString()}`,
    { parse_mode: 'Markdown' }
  );
});

// Gold Command
bot.onText(/\/gold/, (msg) => {
  const { price, time } = getGoldAnalysis();
  bot.sendMessage(
    msg.chat.id,
    `📊 *GOLD (XAU/USD)*\n\n` +
    `💰 Price: $${price}\n` +
    `🕒 Last Updated: ${time}\n\n` +
    `📌 Source: GoldAPI.io`,
    { parse_mode: 'Markdown' }
  );
});

// Helper functions
function getMarketAnalysis(symbol) {
  const data = marketData[symbol];
  let signal = '🔄 WAIT';
  
  if (data.rsi < 30 && data.trend === 'up') signal = '🚀 BUY';
  if (data.rsi > 70 && data.trend === 'down') signal = '⚠️ SELL';
  
  return {
    price: data.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
    rsi: data.rsi ? data.rsi.toFixed(2) : 'Calculating...',
    signal
  };
}

function getGoldAnalysis() {
  return {
    price: marketData.gold.price ? marketData.gold.price.toFixed(2) : 'N/A',
    time: marketData.gold.lastUpdated ? marketData.gold.lastUpdated.toLocaleTimeString() : 'Unknown'
  };
}

console.log('🤖 Bot is running! Use /start in Telegram');
