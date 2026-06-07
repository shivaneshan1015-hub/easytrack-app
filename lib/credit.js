/**
 * Checks whether a shop has enough credit headroom for a new order.
 * Computes live credit_used from non-delivered transactions so the value
 * is always accurate regardless of what's cached in the shops row.
 *
 * @returns {{ allowed: boolean, creditLimit: number, creditUsed: number, available: number }}
 */
export async function checkCreditAvailable(supabase, shopId, orderTotal) {
  const { data: shop, error } = await supabase
    .from('shops')
    .select('credit_limit')
    .eq('id', shopId)
    .single();

  if (error || !shop) return { allowed: true, creditLimit: 0, creditUsed: 0, available: Infinity };

  const creditLimit = parseFloat(shop.credit_limit || 0);
  if (creditLimit <= 0) return { allowed: true, creditLimit: 0, creditUsed: 0, available: Infinity };

  const { data: txData } = await supabase
    .from('transactions')
    .select('pending_amount')
    .eq('shop_id', shopId)
    .neq('status', 'delivered');

  const creditUsed = (txData || []).reduce(
    (sum, tx) => sum + parseFloat(tx.pending_amount || 0),
    0
  );

  const available = creditLimit - creditUsed;
  const allowed = creditUsed + orderTotal <= creditLimit;

  return { allowed, creditLimit, creditUsed, available };
}
