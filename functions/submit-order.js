// File: /netlify/functions/submit-order.js

exports.handler = async function (event, context) {
    // We only accept POST requests to this function
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const SUPABASE_TABLE = 'orders';

    const endpoint = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;

    try {
        const orderData = JSON.parse(event.body);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal' // We don't need the new record back
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Supabase error:', errorBody);
            throw new Error(`Supabase insert failed: ${response.statusText}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order submitted successfully' })
        };

    } catch (error) {
        console.error('Error submitting order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to submit order.' })
        };
    }
};