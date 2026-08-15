// Quick test — run with: node test-email.js
// This will send a test OTP email using your EmailJS credentials

const axios = require('axios');

const EMAILJS_PUBLIC_KEY = '2WokA7W58h_-Iej1A';
const EMAILJS_SERVICE_ID = 'service_sxnolwi';
const EMAILJS_TEMPLATE_ID = 'template_qjbo0j5';

// ← PUT YOUR EMAIL HERE to test
const TEST_EMAIL = 'u5813051@gmail.com';

async function testEmail() {
    console.log('Sending test OTP email via EmailJS...');
    try {
        const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
                to_email: TEST_EMAIL,
                title: '🔐 Your Password Reset OTP',
                name: 'FinanceTracker',
                line: 'Use this code to reset your FinanceTracker password',
                message: 'Your OTP code is:\n\n  123456\n\nThis code expires in 10 minutes.',
                email: 'no-reply@financetracker.app'
            }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ SUCCESS! Email sent. Status:', response.status, response.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ EmailJS Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Network Error:', error.message);
        }
    }
}

testEmail();
