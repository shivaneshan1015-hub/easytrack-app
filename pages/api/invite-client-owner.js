import { createClient } from '@supabase/supabase-js';
import { createTransporter, buildClientOwnerInviteHtml } from '../../lib/mailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, owner_name, owner_email, plan_tier, max_agents, trial_days } = req.body;

  if (!company_name || !owner_email) {
    return res.status(400).json({ error: 'Company name and owner email are required' });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const origin = req.headers.origin || 'https://easytrack-app.vercel.app';
    const loginUrl = `${origin}/login`;
    const trialDaysCount = parseInt(trial_days) || 7;

    // 1. Invite Owner via Supabase Auth
    let authUser = null;
    try {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(owner_email.trim(), {
        redirectTo: `${origin}/dashboard`,
        data: {
          full_name: owner_name || 'Owner',
          role: 'owner'
        }
      });
      if (data?.user) authUser = data.user;
    } catch (e) {
      console.warn('Supabase auth invite notice:', e.message);
    }

    // 2. Create Profile row
    if (authUser) {
      await supabaseAdmin.from('profiles').upsert([{
        id: authUser.id,
        full_name: owner_name || 'Owner',
        email: owner_email.trim(),
        role: 'owner'
      }]);
    }

    // 3. Insert / Update Organization row
    const trialEnd = new Date(Date.now() + trialDaysCount * 24 * 60 * 60 * 1000).toISOString();
    const { data: orgData, error: orgError } = await supabaseAdmin.from('organizations').insert([{
      company_name: company_name.trim(),
      owner_name: owner_name || 'Owner',
      owner_email: owner_email.trim(),
      plan_tier: plan_tier || 'starter',
      max_agents: parseInt(max_agents) || 5,
      status: 'trial',
      trial_ends_at: trialEnd,
      subscription_expires_at: trialEnd
    }]).select().maybeSingle();

    if (orgError && orgError.code !== '42P01') {
      console.warn('Org insert notice:', orgError.message);
    }

    // 4. Dispatch Email Invitation via Nodemailer (if SMTP configured)
    let emailSent = false;
    try {
      const transporter = createTransporter();
      const html = buildClientOwnerInviteHtml({
        companyName: company_name.trim(),
        ownerName: owner_name || 'Partner',
        ownerEmail: owner_email.trim(),
        loginUrl,
        trialDays: trialDaysCount
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"EasyTrack Onboarding" <no-reply@easytrack.app>',
        to: owner_email.trim(),
        subject: `🎉 Welcome to EasyTrack! Workspace Invitation for ${company_name.trim()}`,
        html
      });
      emailSent = true;
    } catch (mailErr) {
      console.warn('Nodemailer notice (SMTP skipped or unconfigured):', mailErr.message);
    }

    return res.status(200).json({
      success: true,
      emailSent,
      message: emailSent
        ? `✅ Invitation email sent to ${owner_email} with login link!`
        : `✅ Onboarded ${company_name}! Direct login link: ${loginUrl}`,
      loginUrl
    });

  } catch (err) {
    console.error('Invite client owner error:', err);
    return res.status(500).json({ error: err.message });
  }
}
