// FINAL CORRECTED VERSION
// File: /netlify/functions/submit-order.js

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const {
        SUPABASE_URL,
        SUPABASE_KEY,
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        EMAILJS_PUBLIC_KEY,
        EMAILJS_PRIVATE_KEY
    } = process.env;

    try {
        const orderData = JSON.parse(event.body);
        const order_id = `T${Date.now().toString().slice(-6)}`;

        // --- 1. SAVE ORDER TO SUPABASE ---
        const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/orders`;

        // This is the corrected data payload. It only includes columns that exist.
        const supabasePayload = {
            order_id: order_id,
            customer_name: orderData.customer_name,
            customer_phone: orderData.customer_phone,
            // The line for 'customer_address_text' has been removed to prevent the crash.
            items: orderData.items,
            total: orderData.total
        };

        const supabaseResponse = await fetch(supabaseEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(supabasePayload)
        });

        if (!supabaseResponse.ok) {
            console.error('Supabase error:', await supabaseResponse.text());
            throw new Error('Failed to save order to Supabase.');
        }

        // --- 2. SEND EMAIL NOTIFICATION ---
        const emailParams = {
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            accessToken: EMAILJS_PRIVATE_KEY,
            template_params: {
                order_id: order_id,
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
            }
        };

        const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailParams)
        });

        if (!emailjsResponse.ok) {
            console.error('EmailJS error:', await emailjsResponse.text());
        }

        // --- 3. RETURN SUCCESS ---
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order submitted successfully' })
        };

    } catch (error) {
        console.error('Error in submit-order function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An error occurred while processing the order.' })
        };
    }
};