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

export function buildClientOwnerInviteHtml({ companyName, ownerName, ownerEmail, loginUrl, trialDays = 7 }) {
  const url = loginUrl || 'https://easytrack-app.vercel.app/login';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family:Arial,sans-serif; }
    .container { width:100%; max-width:600px; margin:20px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; }
    .header { background:#0f172a; padding:32px 28px; text-align:center; }
    .title { color:#ffffff; font-size:24px; font-weight:bold; margin:12px 0 4px; }
    .sub { color:#16a34a; font-size:12px; font-weight:bold; letter-spacing:1px; }
    .body { padding:32px 28px; color:#0f172a; line-height:1.6; }
    .btn { display:inline-block; background:#16a34a; color:#ffffff !important; padding:14px 28px; border-radius:8px; font-weight:bold; text-decoration:none; font-size:15px; margin:20px 0; }
    .footer { background:#f1f5f9; padding:20px; text-align:center; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:26px;font-weight:bold;color:#ffffff;">Easy<span style="color:#16a34a;">Track</span></div>
      <div class="sub">TRACK. MANAGE. GROW.</div>
      <div class="title">Welcome to Your Distributor Workspace</div>
    </div>
    
    <div class="body">
      <p style="font-size:16px;">Hello <strong>${ownerName || 'Partner'}</strong>,</p>
      <p>Your distributor workspace for <strong>${companyName}</strong> has been provisioned on <strong>EasyTrack</strong>!</p>
      
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px 20px;border-radius:10px;margin:20px 0;color:#15803d;">
        🎁 <strong>${trialDays}-Day Free Trial Active:</strong> You have full unrestricted access to Route Optimization, Credit Control, Invoicing, and Field Agent Management.
      </div>

      <p>Click the button below to access your Owner Dashboard and start managing your sales agents and retail store orders:</p>

      <div style="text-align:center;">
        <a href="${url}" class="btn">🚀 Access Owner Dashboard</a>
      </div>

      <p style="font-size:13px;color:#64748b;margin-top:24px;">
        Registered Email: <strong>${ownerEmail}</strong><br>
        Workspace URL: <a href="${url}" style="color:#2563eb;">${url}</a>
      </p>
    </div>

    <div class="footer">
      EasyTrack Distribution & Field Sales Platform<br>
      Automate routes, collections, credit limits, and invoicing.
    </div>
  </div>
</body>
</html>`;
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

  const billAmount  = parseFloat(transaction.bill_amount    || 0);
  const amtReceived = parseFloat(transaction.amount_received || 0);
  const pendingAmt  = parseFloat(transaction.pending_amount  || 0);
  const balanceLabel = pendingAmt > 0 ? 'Balance Due' : 'Grand Total';
  const balanceValue = pendingAmt > 0 ? pendingAmt : billAmount;
  const balanceColor = pendingAmt > 0 ? '#fca5a5' : '#4ade80';

  const rows = (items || []).map((line, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 8px;color:#64748b;font-size:13px;white-space:nowrap;">${i + 1}</td>
      <td style="padding:10px 8px;font-weight:600;font-size:13px;">${line.products?.name || '—'}</td>
      <td style="padding:10px 8px;text-align:right;color:#475569;font-size:13px;white-space:nowrap;">₹${parseFloat(line.quantity > 0 ? line.total_price / line.quantity : (line.products?.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="padding:10px 8px;text-align:center;font-weight:bold;font-size:13px;">${line.quantity}</td>
      <td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:13px;white-space:nowrap;">₹${parseFloat(line.total_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:Arial,sans-serif; }
    .wrapper { width:100%; background:#f1f5f9; padding:16px 0; }
    .container { width:100%; max-width:600px; margin:0 auto; background:#ffffff; }
  </style>
</head>
<body>
<div class="wrapper">
<table class="container" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background:#0f172a;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#f8fafc;">${companyName}</p>
            ${address ? `<p style="margin:0;font-size:11px;color:#94a3b8;">${address.replace(/\n/g, '<br>')}</p>` : ''}
            ${phone   ? `<p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">&#128222; ${phone}</p>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top;">
            <span style="background:#38bdf8;color:#0f172a;padding:4px 10px;font-size:10px;font-weight:bold;">DELIVERY INVOICE</span>
            <p style="margin:8px 0 2px;font-size:12px;color:#e2e8f0;"><strong>Bill No:</strong> ${billNumber}</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">${date}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px 28px;">
      <p style="margin:0 0 3px;font-size:15px;font-weight:bold;color:#0f172a;">${shopName}</p>
      <p style="margin:0;font-size:13px;color:#0f172a;"><strong>Agent:</strong> ${agent}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 28px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;font-size:11px;">#</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;">Product</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;">Rate</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;">Qty</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#475569;font-weight:bold;">Thank you for your business!</p>
      <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">Powered by EasyTrack</p>
    </td>
  </tr>
</table>
</div>
</body>
</html>`;
}
