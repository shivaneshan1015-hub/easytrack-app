import nodemailer from 'nodemailer';

export function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function buildInvoiceHtml({ invoiceSettings, transaction, items }) {
  const co = invoiceSettings || {};
  const companyName = co.company_name || 'EasyTrack Distributors';
  const address     = co.address     || '';
  const phone       = co.phone       || '';
  const gst         = co.gst_number  || '';

  const shopName   = transaction.shops?.name        || 'Retail Store';
  const shopPhone  = transaction.shops?.phone_number || '';
  const billNumber = transaction.bill_number;
  const agent      = transaction.employee_name || 'Field Agent';
  const date       = new Date(transaction.created_at || Date.now())
                       .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const billAmount   = parseFloat(transaction.bill_amount   || 0);
  const amtReceived  = parseFloat(transaction.amount_received || 0);
  const pendingAmt   = parseFloat(transaction.pending_amount  || 0);

  const rows = (items || []).map((line, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px; color:#64748b; font-size:13px;">${i + 1}</td>
      <td style="padding:10px 12px; font-weight:600; font-size:13px;">${line.products?.name || '—'}</td>
      <td style="padding:10px 12px; text-align:right; color:#475569; font-size:13px;">
        ₹${parseFloat(line.products?.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
      <td style="padding:10px 12px; text-align:center; font-weight:bold; font-size:13px;">${line.quantity}</td>
      <td style="padding:10px 12px; text-align:right; font-weight:bold; font-size:13px;">
        ₹${parseFloat(line.total_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">

  <!-- Header -->
  <div style="background:#0f172a;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:20px;font-weight:bold;color:#f8fafc;">${companyName}</p>
          ${address ? `<p style="margin:0;font-size:11px;color:#94a3b8;">${address.replace(/\n/g,'<br>')}</p>` : ''}
          ${phone   ? `<p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">📞 ${phone}</p>` : ''}
          ${gst     ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">GST: ${gst}</p>` : ''}
        </td>
        <td style="text-align:right;vertical-align:top;">
          <span style="display:inline-block;background:#38bdf8;color:#0f172a;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:bold;letter-spacing:1px;">DELIVERY INVOICE</span>
          <p style="margin:8px 0 2px;font-size:13px;color:#e2e8f0;"><strong>Bill No:</strong> ${billNumber}</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">${date}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Bill To / Delivery Info -->
  <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding-right:16px;vertical-align:top;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Bill To</p>
          <p style="margin:0 0 3px;font-size:16px;font-weight:bold;color:#0f172a;">${shopName}</p>
          ${shopPhone ? `<p style="margin:0;font-size:12px;color:#475569;">📞 ${shopPhone}</p>` : ''}
        </td>
        <td width="50%" style="padding-left:16px;vertical-align:top;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Delivery Info</p>
          <p style="margin:0 0 3px;font-size:13px;color:#0f172a;"><strong>Agent:</strong> ${agent}</p>
          <p style="margin:0;font-size:13px;color:#0f172a;"><strong>Status:</strong> Delivered</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Products Table -->
  <div style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr style="background:#0f172a;color:#ffffff;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;">Product</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;">Rate (₹)</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <!-- Totals -->
  <div style="padding:16px 32px 24px;display:flex;justify-content:flex-end;">
    <table cellpadding="0" cellspacing="0" style="width:280px;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;font-size:13px;color:#475569;">Subtotal</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;">₹${billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 10px;font-size:13px;color:#16a34a;font-weight:600;">Collected</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;color:#16a34a;font-weight:600;">₹${amtReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background:#0f172a;">
        <td style="padding:12px 10px;font-size:14px;color:#f8fafc;font-weight:bold;">
          ${pendingAmt > 0 ? 'Balance Due' : 'Grand Total'}
        </td>
        <td style="padding:12px 10px;text-align:right;font-size:16px;font-weight:bold;color:${pendingAmt > 0 ? '#fca5a5' : '#4ade80'};">
          ₹${(pendingAmt > 0 ? pendingAmt : billAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#475569;font-weight:bold;">Thank you for your business!</p>
    <p style="margin:0;font-size:11px;color:#94a3b8;">This is a computer-generated invoice. No signature required.</p>
    <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">Powered by EasyTrack</p>
  </div>

</div>
</body>
</html>`;
}
