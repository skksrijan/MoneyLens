'use strict';

const fs   = require('fs');
const path = require('path');
const Papa = require('papaparse');
const pdf  = require('pdf-parse');
const axios = require('axios');
const { Transaction, Category } = require('../models');

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const normalizeDate = (raw) => {
    if (!raw) return null;
    const s = raw.toString().trim();
    if (!s || s.includes('#')) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const dmyFull = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyFull) {
        const c = new Date(`${dmyFull[3]}-${dmyFull[2].padStart(2,'0')}-${dmyFull[1].padStart(2,'0')}`);
        if (!isNaN(c)) return c.toISOString().split('T')[0];
    }

    const dmyShort = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
    if (dmyShort) {
        const yr = parseInt(dmyShort[3]) > 50 ? '19' + dmyShort[3] : '20' + dmyShort[3];
        const c  = new Date(`${yr}-${dmyShort[2].padStart(2,'0')}-${dmyShort[1].padStart(2,'0')}`);
        if (!isNaN(c)) return c.toISOString().split('T')[0];
    }

    const monName = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/,]+(\d{2,4})$/);
    if (monName) {
        const c = new Date(`${monName[2]} ${monName[1]}, ${monName[3]}`);
        if (!isNaN(c)) return c.toISOString().split('T')[0];
    }

    const monDay = s.match(/^([A-Za-z]{3,9})[\s\-\.]+(\d{1,2})[,\s]+(\d{4})$/);
    if (monDay) {
        const c = new Date(`${monDay[1]} ${monDay[2]}, ${monDay[3]}`);
        if (!isNaN(c)) return c.toISOString().split('T')[0];
    }

    const generic = new Date(s);
    if (!isNaN(generic)) return generic.toISOString().split('T')[0];
    return null;
};

const parseAmount = (val) => {
    if (val === undefined || val === null) return 0;
    const clean = val.toString().replace(/[^0-9.\-]/g, '');
    return clean ? parseFloat(clean) : 0;
};

const cleanHeader = (h) =>
    h.toString().trim().replace(/^\uFEFF/, '').replace(/['"]/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSING
// ─────────────────────────────────────────────────────────────────────────────

const findColumn = (keys, terms) => {
    const lk = keys.map(k => ({ original: k, lower: cleanHeader(k).toLowerCase() }));
    for (const t of terms) {
        const exact = lk.find(k => k.lower === t.toLowerCase());
        if (exact) return exact.original;
    }
    for (const t of terms) {
        const sub = lk.find(k => k.lower.includes(t.toLowerCase()));
        if (sub) return sub.original;
    }
    return undefined;
};

const parseCSV = (filePath, userCurrency = 'USD') => {
    return new Promise((resolve, reject) => {
        try {
            let content = fs.readFileSync(filePath, 'utf-8');
            // Strip BOM
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            // Normalize line endings
            content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // ── Auto-detect delimiter ────────────────────────────────────────
            const firstLine = content.split('\n')[0];
            const counts = {
                ',':  (firstLine.match(/,/g)  || []).length,
                ';':  (firstLine.match(/;/g)  || []).length,
                '\t': (firstLine.match(/\t/g) || []).length,
                '|':  (firstLine.match(/\|/g) || []).length,
            };
            const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

            const parsed = Papa.parse(content, {
                header: false,
                delimiter,
                skipEmptyLines: 'greedy',
            });

            if (!parsed.data || parsed.data.length === 0) return resolve([]);

            // ── Find the header row ──────────────────────────────────────────
            // Broad list of keywords that ANY bank header would contain (lower threshold = 1)
            const headerKeywords = [
                'date','value date','posting date','transaction date','tran date','trans date',
                'value dt','txn date','sl.no',
                'amount','debit','credit','withdrawal','deposit','dr','cr',
                'debit amount','credit amount','withdrawal amt','deposit amt',
                'description','particulars','narration','details','remarks','memo',
                'transaction details','trans desc','narrative','cheque no','chq/ref',
                'balance','closing balance',
            ];
            let headerRowIdx = 0;
            for (let i = 0; i < Math.min(parsed.data.length, 30); i++) {
                const row = parsed.data[i];
                const cells = row.map(c => (c || '').toString().toLowerCase().trim());
                // Lower threshold to 1 — if ANY cell matches a known header keyword, it's the header
                const matchCount = headerKeywords.filter(kw => cells.some(c => c === kw || c.includes(kw))).length;
                if (matchCount >= 1) {
                    headerRowIdx = i;
                    break;
                }
            }

            const headers  = parsed.data[headerRowIdx].map(cleanHeader);
            const dataRows = parsed.data.slice(headerRowIdx + 1);
            console.log(`[CSV] Header row ${headerRowIdx}:`, headers);

            // ── Column mapping — extensive aliases for all major Indian banks ──
            const dateKey   = findColumn(headers, [
                'date','value date','txn date','transaction date','posting date',
                'trans date','value dt','tran date','valuedate','sl date',
                'transaction date(dd-mmm-yyyy)','date of transaction',
            ]);
            const descKey   = findColumn(headers, [
                'description','narration','particulars','remarks','details',
                'memo','transaction details','trans desc','transaction description',
                'narrative','cheque details','cheque number / transaction id',
                'transaction remarks','payee / description',
                'transaction narration','chq/ref number','ref no./cheque no.',
            ]);
            const debitKey  = findColumn(headers, [
                'debit','withdrawal','dr','paid out','withdrawals',
                'debit amount','withdrawal amt','debit(inr)','debit (inr)',
                'withdrawal amount','debit amt.','withdrawal amt.',
                'debit amt','dr amount','dr amt','amount(dr)',
                'debit amount(inr)','withdrawl amount',
            ]);
            const creditKey = findColumn(headers, [
                'credit','deposit','cr','paid in','deposits',
                'credit amount','deposit amt','credit(inr)','credit (inr)',
                'deposit amount','credit amt.','deposit amt.',
                'credit amt','cr amount','cr amt','amount(cr)',
                'credit amount(inr)',
            ]);
            const amtKey    = findColumn(headers, [
                'amount','transaction amount','trans amount','amt','value',
                'net amount','transaction amt','amount (inr)', 'amount(inr)',
                'tran amount',
            ]);
            const typeKey   = findColumn(headers, [
                'type','transaction type','trans type','dr/cr','debit/credit',
                'cr/dr','txn type','type of transaction',
            ]);
            const catKey    = findColumn(headers, ['category','group','tag','classification']);

            console.log(`[CSV] Columns → date:${dateKey} desc:${descKey} debit:${debitKey} credit:${creditKey} amt:${amtKey} type:${typeKey}`);

            // ── Fallback: positional column guessing if headers not matched ──
            let useFallback = false;
            if (!dateKey && !amtKey && !debitKey && !creditKey) {
                console.warn('[CSV] Header matching failed — attempting positional fallback');
                useFallback = true;
            }

            const transactions = [];

            for (const row of dataRows) {
                if (!row || row.length === 0) continue;

                let obj = {};
                if (useFallback) {
                    // Build a virtual object by trying to guess columns from content
                    const cells = row.map(c => (c || '').toString().trim());
                    // Find a cell that looks like a date
                    let dateVal = null, amtVal = null, descVal = null;
                    for (const cell of cells) {
                        if (!dateVal && normalizeDate(cell)) dateVal = cell;
                        else if (!amtVal && /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(cell.replace(/[₹$€£]/g, ''))) amtVal = cell;
                        else if (!descVal && cell.length > 3 && isNaN(parseFloat(cell.replace(/,/g,'')))) descVal = cell;
                    }
                    if (!dateVal || !amtVal) continue;
                    obj['_date'] = dateVal;
                    obj['_amt'] = amtVal;
                    obj['_desc'] = descVal || 'Imported Transaction';
                    // use synthetic keys
                    const date = normalizeDate(dateVal);
                    if (!date) continue;
                    const amount = Math.abs(parseAmount(amtVal));
                    if (amount === 0) continue;
                    transactions.push({
                        date,
                        description: (descVal || 'Imported Transaction').trim(),
                        csvCategory: '',
                        amount: parseFloat(amount.toFixed(2)),
                        type: 'expense', // can't determine without headers
                        currency: userCurrency,
                    });
                    continue;
                }

                headers.forEach((h, i) => { obj[h] = (row[i] || '').toString().trim(); });

                const rawDate = dateKey ? obj[dateKey] : null;
                const date    = normalizeDate(rawDate);
                if (!date) continue;

                const rawDesc = descKey ? obj[descKey] : '';
                const description = rawDesc || 'Imported Transaction';

                let amount = 0;
                let type   = 'expense';

                const dVal = debitKey  ? parseAmount(obj[debitKey])  : 0;
                const cVal = creditKey ? parseAmount(obj[creditKey]) : 0;
                const aVal = amtKey    ? parseAmount(obj[amtKey])    : 0;

                if (dVal !== 0 || cVal !== 0) {
                    if (dVal > 0)      { amount = dVal;           type = 'expense'; }
                    else if (cVal > 0) { amount = cVal;           type = 'income';  }
                    else if (dVal < 0) { amount = Math.abs(dVal); type = 'income';  }
                    else if (cVal < 0) { amount = Math.abs(cVal); type = 'expense'; }
                } else if (aVal !== 0) {
                    amount = Math.abs(aVal);
                    if (typeKey) {
                        const tv = (obj[typeKey] || '').toLowerCase();
                        type = (tv.includes('cr') || tv.includes('credit') || tv.includes('deposit') || tv.includes('income')) ? 'income' : 'expense';
                    } else {
                        type = aVal < 0 ? 'expense' : 'income';
                    }
                }

                // Last resort: scan ALL cells for a numeric value
                if (amount === 0) {
                    for (const h of headers) {
                        if (h === dateKey || h === descKey) continue;
                        const v = parseAmount(obj[h]);
                        if (v !== 0) { amount = Math.abs(v); break; }
                    }
                }

                if (amount === 0) continue;

                transactions.push({
                    date,
                    description: description.trim(),
                    csvCategory: catKey ? obj[catKey] : '',
                    amount:      parseFloat(amount.toFixed(2)),
                    type,
                    currency:    userCurrency,
                });
            }

            console.log(`[CSV] Extracted ${transactions.length} valid transactions`);
            resolve(transactions);
        } catch (err) {
            reject(err);
        }
    });
};


// ─────────────────────────────────────────────────────────────────────────────
// PDF TEXT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const parsePDF = async (filePath) => {
    const buffer = fs.readFileSync(filePath);
    try {
        const data = await pdf(buffer, { normalizeWhitespace: false, disableCombineTextItems: false });
        return data.text || '';
    } catch (err) {
        console.error('[PDF] pdf-parse failed:', err.message);
        return '';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF → AI PARSING
// ─────────────────────────────────────────────────────────────────────────────

const parsePDFWithAI = async (pdfText, userCurrency) => {
    const apiKey = (process.env.XAI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'your_grok_xai_api_key_here') {
        throw new Error('AI API key is missing or is a placeholder.');
    }

    let apiUrl = 'https://api.x.ai/v1/chat/completions';
    let model  = 'grok-beta';
    if (apiKey.startsWith('gsk_')) {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        model  = 'llama-3.3-70b-versatile';
    }

    const MAX_CHARS = 12000;
    const truncated = pdfText.length > MAX_CHARS ? pdfText.slice(0, MAX_CHARS) + '\n[truncated]' : pdfText;

    const systemPrompt = `You are a financial data extractor specializing in bank statements from any country.
Extract ALL transactions from the bank statement text and return ONLY a valid JSON array.
No explanation, no markdown outside the array.

Each object must have:
- "date": "YYYY-MM-DD"
- "description": string
- "amount": positive number
- "type": "income" or "expense"
- "currency": "${userCurrency}" (use this unless clearly stated otherwise)

Credits/deposits/salary/refunds → "income". Debits/withdrawals/payments → "expense".
Ignore balance rows, header rows, subtotals. Return [] if none found.`;

    const response = await axios.post(apiUrl, {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: `Extract transactions from this bank statement:\n\n${truncated}` },
        ],
        temperature: 0.1,
    }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
    });

    const content = response.data.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const result  = JSON.parse(jsonStr);
    return Array.isArray(result) ? result : (result.transactions || []);
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF → REGEX PARSING  (3-strategy cascade)
//
// Strategy 1 SAME-LINE:  Date + amounts on the same line (most digital PDFs)
// Strategy 2 MULTI-LINE: Each table cell on its own consecutive line
// Strategy 3 ANCHOR:     Date found → grab decimal amounts within ±3 lines
// ─────────────────────────────────────────────────────────────────────────────

const parsePDFWithRegex = (text, userCurrency = 'USD') => {
    const nonEmpty = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Log first 600 chars so server logs show the raw layout
    console.log('[PDF Regex] First 600 chars:\n' + text.slice(0, 600));

    // ── Shared constants ───────────────────────────────────────────────────────
    const DATE_PATS = [
        /\b(\d{4}[-\/\.]\d{2}[-\/\.]\d{2})\b/,
        /\b(\d{2}[-\/\.]\d{2}[-\/\.]\d{4})\b/,
        /\b(\d{2}[-\/\.]\d{2}[-\/\.]\d{2})\b/,
        /\b(\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-,]+\d{2,4})\b/i,
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\.]+\d{1,2}[,\s]+\d{4})\b/i,
    ];

    // Amounts MUST have a decimal point (prevents Ref-number integers being picked up)
    const AMT_PAT = /(-?\s*\d{1,3}(?:,\d{3})*\.\d{1,2}|-?\s*\d+\.\d{1,2})/g;

    const INCOME_KWS = [
        'deposit','payroll','salary','credit','refund','interest',
        'dividend','transfer in','received','income','reversal',
        'cashback','reward','funds transfer - from','cr',
    ];
    const SKIP_KWS = [
        'previous balance','opening balance','closing balance',
        'brought forward','balance brought','statement period',
        'account number','account no','sort code','swift','bic','ifsc',
        'date description','withdrawals deposits','debit credit','dr cr',
    ];

    const findDate = (str) => {
        for (const p of DATE_PATS) {
            const m = str.match(p);
            if (m) return { raw: m[0], normalized: normalizeDate(m[1] || m[0]) };
        }
        return null;
    };

    const shouldSkip = (str) => {
        const l = str.toLowerCase().trim();
        if (l.startsWith('***') || l.startsWith('---')) return true;
        return SKIP_KWS.some(kw => l.includes(kw));
    };

    const isIncome = (str) => INCOME_KWS.some(kw => str.toLowerCase().includes(kw));

    const makeResult = (dateInfo, rawText, blockForType) => {
        const amounts = [...rawText.matchAll(AMT_PAT)];
        if (amounts.length === 0) return null;
        const nums   = amounts.map(m => parseFloat(m[0].replace(/[\s,]/g, '')));
        const amount = Math.abs(nums[0]);
        if (amount === 0) return null;
        let desc = rawText
            .replace(dateInfo.raw, '')
            .replace(AMT_PAT, '')
            .replace(/\b\d{4,6}\b/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim() || 'Transaction';
        if (shouldSkip(desc)) return null;
        if (desc.length < 2) return null;
        return {
            date:     dateInfo.normalized,
            description: desc.slice(0, 100),
            amount:   parseFloat(amount.toFixed(2)),
            type:     isIncome(blockForType || rawText) ? 'income' : 'expense',
            currency: userCurrency,
        };
    };

    const dedupe = (arr) => {
        const seen = new Set();
        return arr.filter(t => {
            const k = `${t.date}|${t.amount}|${t.description.slice(0, 25)}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };

    // ── Strategy 1: Same-line ──────────────────────────────────────────────────
    const strategy1 = () => {
        const out = [];
        for (const line of nonEmpty) {
            if (shouldSkip(line)) continue;
            const di = findDate(line);
            if (!di || !di.normalized) continue;
            const r = makeResult(di, line, line);
            if (r) out.push(r);
        }
        console.log(`[PDF S1] ${out.length} transactions`);
        return out;
    };

    // ── Strategy 2: Multi-line blocks ─────────────────────────────────────────
    const strategy2 = () => {
        const out = [];
        let i = 0;
        while (i < nonEmpty.length) {
            const line = nonEmpty[i];
            if (shouldSkip(line)) { i++; continue; }
            const di = findDate(line);
            if (!di || !di.normalized) { i++; continue; }

            // Collect up to 4 more lines as this transaction's block
            const block = [line];
            for (let j = 1; j <= 4 && (i + j) < nonEmpty.length; j++) {
                if (findDate(nonEmpty[i + j])) break;
                block.push(nonEmpty[i + j]);
            }
            const blockText = block.join(' ');
            const r = makeResult(di, blockText, blockText);
            if (r) out.push(r);
            i += block.length;
        }
        console.log(`[PDF S2] ${out.length} transactions`);
        return out;
    };

    // ── Strategy 3: Date-anchor sweep (last resort) ────────────────────────────
    const strategy3 = () => {
        const out = [];
        for (let i = 0; i < nonEmpty.length; i++) {
            const line = nonEmpty[i];
            if (shouldSkip(line)) continue;
            const di = findDate(line);
            if (!di || !di.normalized) continue;
            const context = nonEmpty.slice(i, i + 4).join(' ');
            const r = makeResult(di, context, context);
            if (r) out.push(r);
        }
        console.log(`[PDF S3] ${out.length} transactions`);
        return out;
    };

    let result = strategy1();
    if (result.length === 0) result = strategy2();
    if (result.length === 0) result = strategy3();

    const final = dedupe(result);
    console.log(`[PDF Regex] Final: ${final.length} unique transactions`);
    return final;
};

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const detectDuplicates = async (userId, transactions) => {
    const identifiedDuplicates = [];
    const uniqueTransactions   = [];

    for (const trans of transactions) {
        const normalizedDate = normalizeDate(trans.date) || trans.date;
        const existing = await Transaction.findOne({
            userId,
            amount: parseFloat(parseFloat(trans.amount).toFixed(2)),
            date:   normalizedDate,
            description: {
                $regex:   `^${trans.description.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: 'i',
            },
        });

        if (existing) {
            identifiedDuplicates.push(trans);
        } else {
            uniqueTransactions.push({ ...trans, date: normalizedDate });
        }
    }

    return { uniqueTransactions, identifiedDuplicates };
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTO CATEGORISE
// ─────────────────────────────────────────────────────────────────────────────

const autoCategorize = async (userId, transactions) => {
    const categories = await Category.find({ userId });
    const processed  = [...transactions];

    const keywordMap = {
        // Food & Dining
        'zomato':'Food','swiggy':'Food','dominos':'Food','pizza':'Food',
        'mcdonald':'Food','burger':'Food','kfc':'Food','starbucks':'Food',
        'cafe':'Food','restaurant':'Food',
        // Groceries
        'walmart':'Groceries','bigbasket':'Groceries','grofer':'Groceries',
        'dmart':'Groceries','reliance fresh':'Groceries','grocery':'Groceries',
        'supermarket':'Groceries',
        // Shopping
        'amazon':'Shopping','flipkart':'Shopping','myntra':'Shopping',
        'ajio':'Shopping','target':'Shopping','mall':'Shopping',
        // Entertainment
        'netflix':'Entertainment','spotify':'Entertainment','youtube':'Entertainment',
        'hotstar':'Entertainment','prime video':'Entertainment','jiocinema':'Entertainment',
        'bookmyshow':'Entertainment','cinema':'Entertainment',
        // Transport
        'uber':'Transport','ola':'Transport','lyft':'Transport',
        'rapido':'Transport','metro':'Transport','irctc':'Transport',
        'indigo':'Transport','air india':'Transport','makemytrip':'Transport',
        'petrol':'Transport','fuel':'Transport',
        // Utilities
        'electric':'Utilities','water bill':'Utilities','internet':'Utilities',
        'broadband':'Utilities','airtel':'Utilities','jio':'Utilities',
        'bsnl':'Utilities','vodafone':'Utilities','bescom':'Utilities',
        // Housing
        'rent':'Housing','apartment':'Housing','mortgage':'Housing',
        // Income
        'salary':'Salary','payroll':'Salary','depo':'Salary',
        'dividend':'Salary','credit from':'Salary',
        // Health
        'pharmacy':'Health','hospital':'Health','clinic':'Health',
        'medical':'Health','apollo':'Health','practo':'Health',
        // Education
        'school':'Education','college':'Education','university':'Education',
        'course':'Education','udemy':'Education','coursera':'Education',
    };

    for (const trans of processed) {
        let found = null;

        if (trans.csvCategory) {
            found = categories.find(c => c.name.toLowerCase() === trans.csvCategory.toLowerCase());
        }
        if (!found) {
            found = categories.find(c => trans.description.toLowerCase().includes(c.name.toLowerCase()));
        }
        if (!found) {
            const descLower = trans.description.toLowerCase();
            const kw = Object.keys(keywordMap).find(k => descLower.includes(k));
            if (kw) found = categories.find(c => c.name.toLowerCase() === keywordMap[kw].toLowerCase());
        }

        if (found) trans.categoryId = found._id.toString();
    }

    return processed;
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    parseCSV,
    parsePDF,
    parsePDFWithAI,
    parsePDFWithRegex,
    detectDuplicates,
    autoCategorize,
    normalizeDate,
};
