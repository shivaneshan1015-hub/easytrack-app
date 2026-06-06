import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Step 1: Delete from auth.users — removes login access
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    // Note: profiles row will be deleted automatically due to CASCADE
    // transactions are NOT deleted — they stay intact with employee_name preserved

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete agent error:', err);
    return res.status(500).json({ error: err.message });
  }
}