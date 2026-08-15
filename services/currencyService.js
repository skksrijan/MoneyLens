const axios = require('axios');

let cachedRates = {};
let lastFetch = 0;
const CACHE_DURATION = 3600000; // 1 hour

async function getRates() {
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION && Object.keys(cachedRates).length > 0) {
        return cachedRates;
    }

    try {
        const response = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        cachedRates = response.data.usd;
        lastFetch = now;
        return cachedRates;
    } catch (err) {
        console.error('Failed to fetch currency rates:', err.message);
        // Fallback rates if API fails
        return {
            usd: 1,
            inr: 83,
            eur: 0.92,
            gbp: 0.79,
            jpy: 150
        };
    }
}

async function convert(amount, from, to) {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return 0;
    if (!from || !to || from.toUpperCase() === to.toUpperCase()) return numericAmount;

    const currentRates = await getRates();
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    // Ensure we have rates, fallback to 1 if missing
    const fromRate = currentRates[fromLower] || 1;
    const toRate = currentRates[toLower] || 1;

    // Convert: (Amount / Rate of From) * Rate of To
    // Logic: Amount -> USD Base -> Target
    const inUsd = numericAmount / fromRate;
    const result = inUsd * toRate;

    return isNaN(result) ? numericAmount : result;
}

module.exports = { convert, getRates };
