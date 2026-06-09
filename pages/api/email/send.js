import { createClient } from '@supabase/supabase-js';
import { createTransporter, buildInvoiceHtml } from '../../../lib/mailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transactionId, recipientEmail, ownerId } = req.body;
  if (!transactionId || !recipientEmail) {
    return res.status(400).json({ error: 'transactionId and recipientEmail are required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Fetch transaction with shop info
  const { data: transaction, error: txErr } = await supabase
    .from('transactions')
    .select('id, bill_number, bill_amount, amount_received, pending_amount, employee_name, created_at, shops(name, phone_number)')
    .eq('id', transactionId)
    .single();
  if (txErr || !transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Fetch line items
  const { data: items } = await supabase
    .from('transaction_items')
    .select('quantity, total_price, products(name, unit_price)')
    .eq('transaction_id', transactionId);

  // Fetch owner's invoice settings
  let invoiceSettings = null;
  if (ownerId) {
    const { data } = await supabase
      .from('invoice_settings')
      .select('company_name, address, phone, gst_number')
      .eq('owner_id', ownerId)
      .maybeSingle();
    invoiceSettings = data;
  }

  const html = buildInvoiceHtml({ invoiceSettings, transaction, items: items || [] });

  try {
    const transporter = createTransporter();
    const fromName    = invoiceSettings?.company_name || 'EasyTrack';
    const fromEmail   = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: `Invoice ${transaction.bill_number} — ${transaction.shops?.name || 'Your Store'}`,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Mail send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
