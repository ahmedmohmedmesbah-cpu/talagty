// This is the code for our secure serverless function
// File: /netlify/functions/get-orders.js

exports.handler = async function (event, context) {
    // These lines securely get your Supabase credentials, which we will set up in Netlify later.
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'orders'; // Use 'orders' as default

    // The endpoint for your Supabase 'orders' table.
    const endpoint = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?order=created_at.desc`;

    try {
        // We use 'fetch' to securely call your Supabase database from the server.
        const response = await fetch(endpoint, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        // If the call to Supabase wasn't successful, throw an error.
        if (!response.ok) {
            throw new Error(`Supabase fetch failed: ${response.statusText}`);
        }

        // Get the order data as JSON.
        const data = await response.json();

        // Return the data successfully to the admin page.
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };

    } catch (error) {
        // If anything goes wrong, return an error message.
        console.error('Error fetching from Supabase:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch orders from Supabase.' })
        };
    }
};