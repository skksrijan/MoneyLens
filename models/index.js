import User from './User.js';
import Category from './Category.js';
import Transaction from './Transaction.js';
import Budget from './Budget.js';
import Saving from './Saving.js';
import SavingPlan from './SavingPlan.js';
import BlockchainBlock from './BlockchainBlock.js';

// No Sequelize associations needed — relationships are handled via
// ObjectId refs in schemas and .populate() in queries.

export { User, Category, Transaction, Budget, Saving, SavingPlan, BlockchainBlock };

