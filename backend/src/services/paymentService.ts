/**
 * Mock payment gateway. In a real project you'd swap this for Stripe/Razorpay
 * etc. — the interface (amount + idempotencyKey -> success/failure) is
 * deliberately shaped like a real gateway's API so swapping it out later
 * doesn't require touching bookingService.ts at all.
 *
 * Simulates realistic network latency and a small random failure rate so
 * the "payment failed -> seats released" path in bookingService is
 * actually exercised during testing/demoing, not just theoretical.
 */

interface ChargeParams {
  amount: number;
  idempotencyKey: string;
}

interface ChargeResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED';
  transactionId: string;
}

const FAILURE_RATE = parseFloat(process.env.MOCK_PAYMENT_FAILURE_RATE || '0.05'); // 5%
const SIMULATED_LATENCY_MS = 600;

export async function mockChargePayment(params: ChargeParams): Promise<ChargeResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  if (params.amount <= 0) {
    return { success: false, status: 'FAILED', transactionId: '' };
  }

  const succeeded = Math.random() > FAILURE_RATE;

  return {
    success: succeeded,
    status: succeeded ? 'SUCCESS' : 'FAILED',
    transactionId: `mock_txn_${params.idempotencyKey}`,
  };
}
