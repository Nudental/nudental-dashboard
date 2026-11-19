const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function insuranceReviewLink(requestId) {
  return typeof requestId === 'string' && REQUEST_ID.test(requestId)
    ? `/insurance-verify?request=${encodeURIComponent(requestId)}` : null;
}

export async function loadInsuranceReviewRequest(client, requestId) {
  if (!insuranceReviewLink(requestId)) throw new Error('Invalid request link.');
  // This invoker view enforces the signed-in user's office and Insurance permissions.
  const { data, error } = await client.from('insurance_work_requests').select('*').eq('id', requestId).maybeSingle();
  if (error || !data) throw new Error('This request is unavailable or outside your office access.');
  return data;
}
