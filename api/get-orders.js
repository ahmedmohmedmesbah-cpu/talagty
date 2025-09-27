// This file uses CommonJS syntax for maximum compatibility with Vercel.
module.exports = async (request, response) => {
    const { SUPABASE_URL, SUPABASE_KEY } = process.env;
    const SUPABASE_TABLE = 'orders';

    const endpoint = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?order=created_at.desc`;

    try {
        const supabaseResponse = await fetch(endpoint, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!supabaseResponse.ok) {
            throw new Error(`Supabase fetch failed: ${supabaseResponse.statusText}`);
        }

        const data = await supabaseResponse.json();

        return response.status(200).json(data);

    } catch (error) {
        console.error('Error fetching from Supabase:', error);
        return response.status(500).json({ error: 'Failed to fetch orders from Supabase.' });
    }
};