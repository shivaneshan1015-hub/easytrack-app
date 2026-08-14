import { createClient } from '@supabase/supabase-js';

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const KNOWN_PERMISSIONS = ['today', 'dispatch', 'finance', 'shops', 'shops_pricing', 'routes', 'settings'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { userId, permissions } = req.body;
  if (!userId || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'userId and permissions[] are required' });
  }

  const cleanPermissions = permissions.filter(p => KNOWN_PERMISSIONS.includes(p));

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Only an owner may edit another team member's permissions
    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' });

    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfileErr || callerProfile?.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can edit team member permissions' });
    }

    // Scoped to role='dispatcher' so this can't be used to touch an owner's or agent's row
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ permissions: cleanPermissions })
      .eq('id', userId)
      .eq('role', 'dispatcher')
      .select('id')
      .single();

    if (updateErr || !updated) {
      return res.status(404).json({ error: 'No matching dispatcher-role user found for that userId' });
    }

    return res.status(200).json({ success: true, permissions: cleanPermissions });
  } catch (err) {
    console.error('Update permissions error:', err);
    return res.status(500).json({ error: err.message });
  }
}
