import axios from 'axios';
import { Transaction, Budget, Saving, Category, User } from '../models/index.js';
import { convert } from './currencyService.js';

const getAIResponse = async (userId, userMessage, conversationHistory = []) => {
    try {
        const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.XAI_API_KEY || '').trim();
        if (!apiKey) {
            return "AI feature is not configured. Please add GEMINI_API_KEY or XAI_API_KEY to environment variables.";
        }

        let apiUrl = 'https://api.x.ai/v1/chat/completions';
        let model = 'grok-beta';

        if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
            apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
            model = 'gemini-2.5-flash';
        } else if (apiKey.startsWith('gsk_')) {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            model = 'llama-3.3-70b-versatile';
        }

        // 1. Fetch User Data & Currency Preference
        const user = await User.findById(userId);
        const userCurrency = user ? (user.currency || 'USD') : 'USD';

        // 2. Fetch User Financial Context
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const [allTransactions, budgets, savings] = await Promise.all([
            Transaction.find({ userId })
                .populate('categoryId')
                .sort({ date: -1 })
                .limit(50),
            Budget.find({ userId }).populate('categoryId'),
            Saving.find({ userId })
        ]);

        // Convert amounts to user's currency for accurate context
        let totalMonthlyIncome = 0;
        let totalMonthlyExpense = 0;
        const categorySpendingMap = {};

        const formattedTransactions = await Promise.all(allTransactions.map(async (t) => {
            const convertedAmt = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            const catName = t.categoryId ? t.categoryId.name : 'Uncategorized';

            if (t.date >= startOfMonth && t.date <= endOfMonth) {
                if (t.type === 'income') {
                    totalMonthlyIncome += convertedAmt;
                } else {
                    totalMonthlyExpense += convertedAmt;
                    categorySpendingMap[catName] = (categorySpendingMap[catName] || 0) + convertedAmt;
                }
            }

            return `${t.date}: [${t.type.toUpperCase()}] ${userCurrency} ${convertedAmt.toFixed(2)} (${catName}) - "${t.description || 'No desc'}"`;
        }));

        // Format Budget status
        const budgetSummary = await Promise.all(budgets.map(async (b) => {
            const catName = b.categoryId ? b.categoryId.name : 'Unknown';
            const limitInUserCurrency = await convert(parseFloat(b.amount), 'USD', userCurrency);
            const spent = categorySpendingMap[catName] || 0;
            const percent = limitInUserCurrency > 0 ? ((spent / limitInUserCurrency) * 100).toFixed(1) : 0;
            const isExceeded = spent > limitInUserCurrency;
            return `${catName}: Spent ${userCurrency} ${spent.toFixed(2)} / Limit ${userCurrency} ${limitInUserCurrency.toFixed(2)} (${percent}% used${isExceeded ? ' ⚠️ EXCEEDED' : ''})`;
        }));

        // 3. Prepare detailed context string
        const financialContext = `
User Profile: ${user ? user.name : 'User'} (Currency: ${userCurrency})
Current Month: ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}

--- MONTHLY SUMMARY ---
- Total Monthly Income: ${userCurrency} ${totalMonthlyIncome.toFixed(2)}
- Total Monthly Expenditures: ${userCurrency} ${totalMonthlyExpense.toFixed(2)}
- Net Balance / Monthly Savings: ${userCurrency} ${(totalMonthlyIncome - totalMonthlyExpense).toFixed(2)}

--- CATEGORY-WISE SPENDING (THIS MONTH) ---
${Object.keys(categorySpendingMap).length > 0
    ? Object.entries(categorySpendingMap).map(([cat, amt]) => `- ${cat}: ${userCurrency} ${amt.toFixed(2)}`).join('\n')
    : 'No expenses recorded this month yet.'}

--- BUDGETS & LIMITS ---
${budgetSummary.length > 0 ? budgetSummary.map(b => `- ${b}`).join('\n') : 'No budgets set.'}

--- SAVINGS GOALS & ASSETS ---
${savings.length > 0 ? savings.map(s => `- ${s.source}: $${s.amount} USD`).join('\n') : 'No savings goals set.'}

--- RECENT TRANSACTIONS (UP TO 50) ---
${formattedTransactions.length > 0 ? formattedTransactions.slice(0, 30).join('\n') : 'No transactions recorded yet.'}
        `.trim();

        // 4. Call AI API
        const response = await axios.post(apiUrl, {
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are 'FinanceGuru', a highly intelligent and personalized AI financial advisor for MoneyLens.
You have FULL ACCESS to the user's live financial data provided in the context below. 

Use this detailed financial context to give precise, personal, accurate advice, expenditure analysis, category breakdowns, and budgeting tips in ${userCurrency}.

Financial Context:
${financialContext}`
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
            timeout: 15000
        });

        return response.data.choices[0].message.content;

    } catch (error) {
        if (error.response) {
            console.error('AI API Error Status:', error.response.status);
            console.error('AI API Error Data:', JSON.stringify(error.response.data));
        } else {
            console.error('AI API Request Error:', error.message);
        }
        return "I'm having trouble connecting right now. Error: " + (error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message);
    }
};

export { getAIResponse };
