import { createTransporter } from '../../../lib/mailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'owner') return res.status(403).json({ error: 'Forbidden — owner only' });

  const { testEmail } = req.body;
  if (!testEmail) return res.status(400).json({ error: 'testEmail is required' });

  try {
    const transporter = createTransporter();
    await transporter.verify();
    const testHtml = `<div style="font-family:Arial,sans-serif;padding:32px;max-width:480px;">
        <h2 style="color:#0f172a;margin:0 0 12px;">&#10003; SMTP is working!</h2>
        <p style="color:#475569;margin:0 0 8px;">Your EasyTrack SMTP configuration is set up correctly.</p>
        <p style="color:#475569;margin:0;">You can now email invoices directly from the Dispatched Ledger.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Sent from EasyTrack &middot; ${new Date().toLocaleString('en-IN')}</p>
      </div>`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: testEmail,
      subject: 'EasyTrack — SMTP Test',
      html: testHtml,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SMTP test error:', err);
    return res.status(500).json({ error: err.message });
  }
}
