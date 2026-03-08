const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const sk = process.env.STRIPE_SECRET_KEY;
console.log('Testing key:', sk ? `${sk.substring(0, 7)}...${sk.substring(sk.length - 4)}` : 'MISSING');
console.log('Key length:', sk ? sk.length : 0);

if (!sk) {
    console.error('ERROR: STRIPE_SECRET_KEY is not defined in .env.local');
    process.exit(1);
}

const stripe = new Stripe(sk, {
    apiVersion: '2024-06-20',
});

async function test() {
    try {
        console.log('Attempting to retrieve balance...');
        const balance = await stripe.balance.retrieve();
        console.log('SUCCESS! Balance retrieved:', JSON.stringify(balance, null, 2));
    } catch (error) {
        console.error('FAILURE! Stripe Error:');
        console.error('Type:', error.type);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Status Code:', error.statusCode);
        process.exit(1);
    }
}

test();
