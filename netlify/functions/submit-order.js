// FINAL CORRECTED VERSION
// File: /netlify/functions/submit-order.js

// Helper function to format items for the email
function formatItemsForEmail(items) {
    if (!Array.isArray(items)) return '<p>No items in order.</p>';

    let itemsList = items.map(item =>
        `<li>${item.name || `Product ID: ${item.id}`} (Quantity: ${item.quantity})</li>`
    ).join('');

    return `<ul>${itemsList}</ul>`;
}


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
        const order_id = `T${Date.now().toString().slice(-6)}`;

        // --- 1. SAVE ORDER TO SUPABASE ---
        const supabaseEndpoint = `${SUPABASE_URL}/rest/v1/orders`;
        const supabasePayload = {
            order_id: order_id,
            customer_name: orderData.customer_name,
            customer_phone: orderData.customer_phone,
            customer_address_text: orderData.customer_address_text,
            items: orderData.items, // Storing the cart items with names
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
                customer_address: orderData.customer_address_text,
                items_html: formatItemsForEmail(orderData.items),
                total: `${orderData.total.toFixed(2)} SAR`
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