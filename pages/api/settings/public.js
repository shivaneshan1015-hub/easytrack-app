import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase
    .from('invoice_settings')
    .select('company_name, upi_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return res.status(200).json({
    company_name: data?.company_name || 'EasyTrack',
    upi_id: data?.upi_id || '',
  });
}
