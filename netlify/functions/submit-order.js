// FINAL VERSION
// File: /netlify/functions/submit-order.js

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Get credentials from Netlify environment variables
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

        // --- 1. GENERATE A UNIQUE ORDER ID ---
        // Creates an ID based on the current date and a random number
        const order_id = `T${Date.now().toString().slice(-6)}`;

        // --- 2. SAVE ORDER TO SUPABASE ---
        const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/orders`;
        const supabaseResponse = await fetch(supabaseEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                // Add the new order_id to the data saved in Supabase
                order_id: order_id,
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
                customer_address_text: orderData.customer_address_text,
                items: orderData.items,
                total: orderData.total
            })
        });

        if (!supabaseResponse.ok) {
            console.error('Supabase error:', await supabaseResponse.text());
            throw new Error('Failed to save order to Supabase.');
        }

        // --- 3. SEND EMAIL NOTIFICATION VIA EMAILJS ---
        const emailParams = {
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            accessToken: EMAILJS_PRIVATE_KEY, // The Private Key is used for secure, backend requests
            template_params: {
                // These parameters must exactly match the variables in your EmailJS template
                order_id: order_id,
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone
            }
        };

        const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailParams)
        });

        if (!emailjsResponse.ok) {
            // Log the email error but don't fail the function. Saving the order is most important.
            console.error('EmailJS error:', await emailjsResponse.text());
        }

        // --- 4. RETURN SUCCESS TO THE USER ---
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