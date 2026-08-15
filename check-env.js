require('dotenv').config();
console.log('PORT:', process.env.PORT);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_SSL:', process.env.DB_SSL ?? '(not set)');
console.log('PGSSLMODE:', process.env.PGSSLMODE ?? '(not set)');
console.log('XAI_API_KEY:', process.env.XAI_API_KEY ? 'Present' : 'MISSING');
