const { User } = require('./models');

async function verifyAllUsers() {
    try {
        const count = await User.update({ isVerified: true }, {
            where: { isVerified: false }
        });
        console.log(`Successfully verified ${count[0]} existing users.`);
        process.exit(0);
    } catch (err) {
        console.error('Error verifying users:', err);
        process.exit(1);
    }
}

verifyAllUsers();
