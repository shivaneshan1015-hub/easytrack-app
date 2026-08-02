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
  <meta name="x-apple-disable-message-reformatting">
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:Arial,sans-serif; -webkit-text-size-adjust:100%; }
    .wrapper { width:100%; background:#f1f5f9; padding:16px 0; }
    .container { width:100%; max-width:600px; margin:0 auto; background:#ffffff; }
    .header-td-right { text-align:right; vertical-align:top; }
    .bill-col { width:50%; vertical-align:top; padding:0 12px 0 0; }
    .delivery-col { width:50%; vertical-align:top; padding:0 0 0 12px; border-left:1px solid #e2e8f0; }
    .totals-spacer { width:50%; }
    .totals-table { width:50%; }
    @media only screen and (max-width:480px) {
      .wrapper { padding:0 !important; }
      .container { width:100% !important; }
      .header-inner { display:block !important; }
      .header-td-right { display:block !important; text-align:left !important; padding-top:14px !important; }
      .bill-col { display:block !important; width:100% !important; padding:0 0 14px 0 !important; border-bottom:1px solid #e2e8f0; }
      .delivery-col { display:block !important; width:100% !important; padding:14px 0 0 0 !important; border-left:none !important; }
      .totals-spacer { display:none !important; }
      .totals-table { width:100% !important; }
      .pad { padding-left:16px !important; padding-right:16px !important; }
      .pad-sm { padding-left:12px !important; padding-right:12px !important; }
      td, th { font-size:12px !important; padding:8px 6px !important; }
    }
  </style>
</head>
<body>
<div class="wrapper">
<table class="container" cellpadding="0" cellspacing="0" border="0">

  <!-- ── HEADER ── -->
  <tr>
    <td style="background:#0f172a;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" class="header-inner">
        <tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#f8fafc;">${companyName}</p>
            ${address ? `<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">${address.replace(/\n/g, '<br>')}</p>` : ''}
            ${phone   ? `<p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">&#128222; ${phone}</p>` : ''}
            ${gst     ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">GST: ${gst}</p>` : ''}
          </td>
          <td class="header-td-right">
            <span style="display:inline-block;background:#38bdf8;color:#0f172a;padding:4px 10px;font-size:10px;font-weight:bold;letter-spacing:1px;">DELIVERY INVOICE</span>
            <p style="margin:8px 0 2px;font-size:12px;color:#e2e8f0;"><strong>Bill No:</strong> ${billNumber}</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">${date}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BILL TO / DELIVERY INFO ── -->
  <tr>
    <td style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px 28px;" class="pad">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td class="bill-col">
            <p style="margin:0 0 5px;font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Bill To</p>
            <p style="margin:0 0 3px;font-size:15px;font-weight:bold;color:#0f172a;">${shopName}</p>
            ${shopPhone ? `<p style="margin:0;font-size:12px;color:#475569;">&#128222; ${shopPhone}</p>` : ''}
          </td>
          <td class="delivery-col">
            <p style="margin:0 0 5px;font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Delivery Info</p>
            <p style="margin:0 0 3px;font-size:13px;color:#0f172a;"><strong>Agent:</strong> ${agent}</p>
            <p style="margin:0;font-size:13px;color:#0f172a;"><strong>Status:</strong> Delivered</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── PRODUCTS TABLE ── -->
  <tr>
    <td style="padding:20px 28px 0;" class="pad">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;">
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:bold;" class="pad-sm">#</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:bold;">Product</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:bold;white-space:nowrap;">Rate (&#8377;)</th>
            <th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:bold;">Qty</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:bold;white-space:nowrap;">Amount (&#8377;)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </td>
  </tr>

  <!-- ── TOTALS ── -->
  <tr>
    <td style="padding:16px 28px 24px;" class="pad">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td class="totals-spacer"></td>
          <td class="totals-table">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 10px;font-size:13px;color:#475569;">Subtotal</td>
                <td style="padding:8px 10px;text-align:right;font-size:13px;color:#0f172a;">&#8377;${billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 10px;font-size:13px;color:#16a34a;font-weight:600;">Collected</td>
                <td style="padding:8px 10px;text-align:right;font-size:13px;color:#16a34a;font-weight:600;">&#8377;${amtReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="background:#0f172a;">
                <td style="padding:12px 10px;font-size:14px;color:#f8fafc;font-weight:bold;">${balanceLabel}</td>
                <td style="padding:12px 10px;text-align:right;font-size:15px;font-weight:bold;color:${balanceColor};">&#8377;${balanceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── FOOTER ── -->
  <tr>
    <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;text-align:center;" class="pad">
      <p style="margin:0 0 4px;font-size:12px;color:#475569;font-weight:bold;">Thank you for your business!</p>
      <p style="margin:0;font-size:11px;color:#94a3b8;">Computer-generated invoice. No signature required.</p>
      <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;">Powered by EasyTrack</p>
    </td>
  </tr>

</table>
</div>
</body>
</html>`;
}
