const User = require('./User');
const Category = require('./Category');
const Transaction = require('./Transaction');
const Budget = require('./Budget');
const Saving = require('./Saving');
const SavingPlan = require('./SavingPlan');
const BlockchainBlock = require('./BlockchainBlock');

// No Sequelize associations needed — relationships are handled via
// ObjectId refs in schemas and .populate() in queries.

module.exports = { User, Category, Transaction, Budget, Saving, SavingPlan, BlockchainBlock };
