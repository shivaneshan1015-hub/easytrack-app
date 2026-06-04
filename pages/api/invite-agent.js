import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, full_name } = req.body;

  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email and full name are required' });
  }

  // Use service role key — this bypasses RLS and can invite users
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Step 1: Invite the user via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name,
        role: 'agent'
      }
    });

    if (error) throw error;

    // Step 2: Insert profile row with agent role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([{
        id: data.user.id,
        full_name: full_name,
        email: email,
        role: 'agent'
      }]);

    if (profileError) throw profileError;

    return res.status(200).json({ success: true, message: `Invitation sent to ${email}` });

  } catch (err) {
    console.error('Invite error:', err);
    return res.status(500).json({ error: err.message });
  }
}