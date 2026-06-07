/**
 * Checks whether a shop has enough credit headroom for a new order.
 * Computes live credit_used from non-delivered transactions so the value
 * is always accurate regardless of what's cached in the shops row.
 *
 * @returns {{ allowed: boolean, creditLimit: number, creditUsed: number, available: number }}
 */
export async function checkCreditAvailable(supabase, shopId, orderTotal) {
  console.log('[credit] checkCreditAvailable called — shopId:', shopId, '| orderTotal:', orderTotal);

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('credit_limit')
    .eq('id', shopId)
    .single();

  console.log('[credit] shop row fetched:', shop, '| error:', shopError);

  if (shopError || !shop) {
    console.warn('[credit] could not fetch shop — bypassing credit check. error:', shopError?.message);
    return { allowed: true, creditLimit: 0, creditUsed: 0, available: Infinity };
  }

  const creditLimit = parseFloat(shop.credit_limit || 0);
  console.log('[credit] credit_limit from DB:', shop.credit_limit, '| parsed:', creditLimit);

  if (creditLimit <= 0) {
    console.log('[credit] no credit limit set (0 or null) — order allowed');
    return { allowed: true, creditLimit: 0, creditUsed: 0, available: Infinity };
  }

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('bill_amount')
    .eq('shop_id', shopId)
    .neq('status', 'delivered');

  console.log('[credit] open transactions:', txData, '| txError:', txError);

  const creditUsed = (txData || []).reduce(
    (sum, tx) => sum + parseFloat(tx.bill_amount || 0),
    0
  );

  const available = creditLimit - creditUsed;
  const allowed = creditUsed + orderTotal <= creditLimit;

  console.log('[credit] creditUsed:', creditUsed, '| available:', available, '| allowed:', allowed);

  return { allowed, creditLimit, creditUsed, available };
}
