import axios from 'axios';

/**
 * EmailJS REST API sender (server-side via axios)
 *
 * Template variables used:
 *   {{to_email}}  → recipient's email  (set "To Email" field in dashboard to {{to_email}})
 *   {{title}}     → email subject / heading
 *   {{name}}      → sender display name (always "MoneyLens")
 *   {{line}}      → subtitle / short description line
 *   {{message}}   → main body content
 *   {{email}}     → reply-to address
 */
const sendEmail = async ({ to_email, title, line, message }) => {
    if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
        console.error('EmailJS env vars missing (EMAILJS_PUBLIC_KEY / EMAILJS_SERVICE_ID / EMAILJS_TEMPLATE_ID). Email skipped.');
        return false;
    }

    try {
        const payload = {
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            template_params: {
                to_email,
                title,
                name: 'MoneyLens',
                line,
                message,
                email: 'no-reply@moneylens.app'
            }
        };

        if (process.env.EMAILJS_PRIVATE_KEY) {
            payload.accessToken = process.env.EMAILJS_PRIVATE_KEY;
        }

        const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[EmailJS Success] Sent email to ${to_email} [${title}] — ${response.status} ${response.data}`);
        return true;
    } catch (error) {
        const detail = error.response ? `${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        console.error(`[EmailJS Error] Failed to send email [${title}]:`, detail);
        if (error.response && error.response.status === 403) {
            console.error('⚠️ [EmailJS Security Setting Required] Please go to https://dashboard.emailjs.com/admin/account/security and enable "Allow EmailJS API for non-browser requests".');
        }
        return false;
    }
};

// ---------------------------------------------------------------------------
// BUDGET ALERT
// ---------------------------------------------------------------------------
const sendBudgetAlert = async (userEmail, categoryName, budgetAmount, spentAmount) => {
    const overrun = (spentAmount - budgetAmount).toLocaleString();
    return sendEmail({
        to_email: userEmail,
        title: `⚠️ Budget Alert: ${categoryName} Limit Exceeded!`,
        line: 'Your monthly spending has gone over the limit',
        message:
            `You have exceeded your monthly budget for: ${categoryName}\n\n` +
            `Budget Limit : $${budgetAmount.toLocaleString()}\n` +
            `Current Spent: $${spentAmount.toLocaleString()}\n` +
            `Overrun      : $${overrun}\n\n` +
            `We recommend reviewing your recent transactions to get back on track.\n\n` +
            `Review Budgets: ${process.env.BASE_URL || 'http://localhost:3000'}/budgets`
    });
};

// ---------------------------------------------------------------------------
// BUDGET UPDATED NOTIFICATION
// ---------------------------------------------------------------------------
const sendBudgetUpdate = async (userEmail, categoryName, newLimit, userCurrency) => {
    const formatted = newLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sendEmail({
        to_email: userEmail,
        title: `✅ Budget Updated: ${categoryName}`,
        line: 'Your budget limit has been successfully changed',
        message:
            `Your budget for the category "${categoryName}" has been updated.\n\n` +
            `New Limit: ${userCurrency} ${formatted}\n\n` +
            `Manage all budgets: ${process.env.BASE_URL || 'http://localhost:3000'}/budgets`
    });
};

// ---------------------------------------------------------------------------
// TRANSACTION + BUDGET PROGRESS NOTIFICATION
// ---------------------------------------------------------------------------
const sendTransactionBudgetUpdate = async (userEmail, categoryName, transactionDetail, budgetLimit, currentSpent, userCurrency) => {
    const percent = (currentSpent / budgetLimit) * 100;
    const statusLine = percent > 100 ? '⚠️ Budget Exceeded!' : `${percent.toFixed(1)}% of budget used`;
    const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

    return sendEmail({
        to_email: userEmail,
        title: `📊 Transaction Recorded: ${categoryName}`,
        line: statusLine,
        message:
            `A ${transactionDetail.type} was recorded in "${categoryName}".\n\n` +
            `Amount     : ${userCurrency} ${fmt(transactionDetail.amount)}\n` +
            `Description: ${transactionDetail.description || 'N/A'}\n\n` +
            `── Budget Progress ──\n` +
            `Spent : ${userCurrency} ${fmt(currentSpent)}\n` +
            `Limit : ${userCurrency} ${fmt(budgetLimit)}\n` +
            `Status: ${statusLine}\n\n` +
            `Go to Dashboard: ${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`
    });
};

// ---------------------------------------------------------------------------
// PASSWORD RESET OTP
// ---------------------------------------------------------------------------
const sendOTP = async (userEmail, otp) => {
    return sendEmail({
        to_email: userEmail,
        title: '🔐 Your Password Reset OTP',
        line: 'Use this code to reset your MoneyLens password',
        message:
            `We received a request to reset your password.\n\n` +
            `Your OTP code is:\n\n` +
            `  ${otp}\n\n` +
            `This code expires in 10 minutes.\n\n` +
            `If you did not request this, please ignore this email.`
    });
};

// ---------------------------------------------------------------------------
// EMAIL VERIFICATION
// ---------------------------------------------------------------------------
const sendVerificationEmail = async (userEmail, otp) => {
    return sendEmail({
        to_email: userEmail,
        title: '📧 Verify Your Email — MoneyLens',
        line: 'Enter this code to activate your account',
        message:
            `Welcome to MoneyLens!\n\n` +
            `Use the code below to verify your email address:\n\n` +
            `  ${otp}\n\n` +
            `This code expires in 10 minutes.\n\n` +
            `If you did not sign up, please ignore this email.`
    });
};

export { sendBudgetAlert, sendBudgetUpdate, sendTransactionBudgetUpdate, sendOTP, sendVerificationEmail };
