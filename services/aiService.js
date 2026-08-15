const axios = require('axios');
const { Transaction, Budget, Saving, Category } = require('../models');

const getAIResponse = async (userId, userMessage, conversationHistory = []) => {
    try {
        const apiKey = process.env.XAI_API_KEY ? process.env.XAI_API_KEY.trim() : null;
        if (!apiKey) {
            return "AI feature is not configured. Please add XAI_API_KEY to environment variables.";
        }

        console.log(`Using API Key starting with: ${apiKey.substring(0, 8)}...`);

        // Detect Provider: Groq (starts with gsk_) or Grok (xAI)
        let apiUrl = 'https://api.x.ai/v1/chat/completions';
        let model = 'grok-beta';

        if (apiKey.startsWith('gsk_')) {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            model = 'llama-3.3-70b-versatile'; // Best versatile model on Groq
            console.log('Detected Groq API key, switching to Groq endpoint.');
        }

        // 1. Fetch User Financial Context
        const now = new Date();

        const [transactions, budgets, savings] = await Promise.all([
            Transaction.find({ userId })
                .populate('categoryId')
                .sort({ date: -1 })
                .limit(20),
            Budget.find({ userId }).populate('categoryId'),
            Saving.find({ userId })
        ]);

        // 2. Prepare context string
        const financialContext = `
Current Date: ${now.toDateString()}
User Financial Data:
- Recent Transactions: ${transactions.map(t => `${t.date}: ${t.type === 'income' ? '+' : '-'}${t.amount} ${t.currency} (${t.categoryId ? t.categoryId.name : 'Uncategorized'}) - ${t.description || ''}`).join('; ')}
- Monthly Budgets: ${budgets.map(b => `${b.categoryId ? b.categoryId.name : '??'}: ${b.amount} USD limit`).join('; ')}
- Savings Goals/Items: ${savings.map(s => `${s.source}: ${s.amount} USD`).join('; ')}
        `.trim();

        // 3. Call API (OpenAI Compatible)
        console.log(`Calling AI API: ${apiUrl} with model: ${model}`);

        const response = await axios.post(apiUrl, {
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are 'FinanceGuru', a professional AI financial advisor. 
                    Context: ${financialContext}`
                },
                ...conversationHistory,
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10s timeout
        });

        return response.data.choices[0].message.content;

    } catch (error) {
        if (error.response) {
            console.error('AI API Error Status:', error.response.status);
            console.error('AI API Error Data:', JSON.stringify(error.response.data));
        } else {
            console.error('AI API Request Error:', error.message);
        }
        return "I'm having trouble connecting to my brain right now. Please check if your API key is valid and has enough credits. Error: " + (error.response ? error.response.status : error.message);
    }
};

module.exports = { getAIResponse };
