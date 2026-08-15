/**
 * Quick CSV Diagnostic Tool
 * Usage: node debug-csv.js path/to/your/statement.csv
 * 
 * Prints the detected header row, column mapping, and first 5 parsed transactions.
 */
require('dotenv').config();
const path = require('path');
const { parseCSV } = require('./services/importService');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node debug-csv.js <path-to-csv-file>');
    process.exit(1);
}

const absPath = path.resolve(filePath);
console.log(`\n🔍 Diagnosing CSV: ${absPath}\n`);

parseCSV(absPath, 'INR')
    .then(transactions => {
        console.log(`\n✅ Total transactions parsed: ${transactions.length}`);
        if (transactions.length > 0) {
            console.log('\nFirst 5 transactions:');
            transactions.slice(0, 5).forEach((t, i) => {
                console.log(`  ${i + 1}. [${t.date}] ${t.type.toUpperCase()} ${t.currency} ${t.amount} — "${t.description}"`);
            });
        } else {
            console.log('\n⚠️  No transactions extracted. Check the [CSV] log lines above for column mapping.');
        }
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
    });
