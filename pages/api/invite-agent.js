import { createClient } from '@supabase/supabase-js';

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { email, full_name, role } = req.body;
  const inviteRole = role === 'dispatcher' ? 'dispatcher' : 'agent';

  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email and full name are required' });
  }

  // Use service role key — this bypasses RLS and can invite users
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Only an owner may invite new team members (of any role)
    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' });

    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfileErr || callerProfile?.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can invite team members' });
    }

    // Step 1: Invite the user via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name,
        role: inviteRole
      }
    });

    if (error) throw error;

    // Step 2: Insert profile row with the requested role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([{
        id: data.user.id,
        full_name: full_name,
        email: email,
        role: inviteRole
      }]);

    if (profileError) throw profileError;

    return res.status(200).json({ success: true, message: `Invitation sent to ${email}` });

  } catch (err) {
    console.error('Invite error:', err);
    return res.status(500).json({ error: err.message });
  }
}
