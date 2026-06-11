import { createClient } from '@supabase/supabase-js';

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { agent_name, shop_id, shop_name, outcome, note, latitude, longitude } = req.body;
  if (!agent_name || !shop_id) return res.status(400).json({ error: 'agent_name and shop_id are required' });

  const { error } = await serviceClient.from('shop_visits').insert([{
    agent_name,
    shop_id,
    shop_name,
    outcome: outcome || 'visited',
    note: note || null,
    latitude: latitude || null,
    longitude: longitude || null,
    visited_at: new Date().toISOString(),
  }]);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
