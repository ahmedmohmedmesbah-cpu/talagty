// This file uses CommonJS syntax and is now correct for your database.
module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { SUPABASE_URL, SUPABASE_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;

    try {
        const orderData = request.body;
        const order_id = `T${Date.now().toString().slice(-6)}`;

        // This payload is now correct because the database no longer has an 'order_details' column.
        const supabasePayload = {
            order_id: order_id,
            customer_name: orderData.customer_name,
            customer_phone: orderData.customer_phone,
            customer_address_text: orderData.customer_address_text,
            items: orderData.items,
            total: orderData.total
        };

        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify(supabasePayload)
        });

        if (!supabaseResponse.ok) {
            const errorText = await supabaseResponse.text();
            console.error('Supabase error:', errorText);
            throw new Error(`Failed to save order to Supabase. Response: ${errorText}`);
        }

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

        fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailParams)
        }).catch(err => console.error("EmailJS sending error:", err));

        return response.status(200).json({ message: 'Order submitted successfully', order_id: order_id });

    } catch (error) {
        console.error('CRITICAL ERROR in submit-order function:', error.message);
        return response.status(500).json({ error: 'An internal server error occurred.' });
    }
};