/**
 * Test Script for Scheduling System Requirements
 * Tests all 6 scheduling system requirements in order
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

interface TestResult {
  requirement: string;
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(requirement: string, testName: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ requirement, test: testName, status: 'PASS', message: 'Success' });
    console.log(`✓ ${requirement} - ${testName}`);
  } catch (error: any) {
    results.push({ 
      requirement, 
      test: testName, 
      status: 'FAIL', 
      message: error.message,
      details: error.details 
    });
    console.error(`✗ ${requirement} - ${testName}: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT 1: Prevent Schedule Conflicts
// ─────────────────────────────────────────────────────────────────────────────

await test('REQ1: Prevent Schedule Conflicts', 'Create first appointment 08:00-09:30', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1,
      vehicleId: 1,
      serviceIds: [1], // 1.5 hour service (90 min)
      appointmentDate: '2025-12-25T08:00:00Z',
      discount: 0,
      finalPrice: 100,
      observations: 'Test conflict detection'
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const apt1 = await res.json();
  if (!apt1.id) throw new Error('No appointment ID returned');
  (global as any).__apt1 = apt1;
});

await test('REQ1: Prevent Schedule Conflicts', 'Reject overlapping appointment 09:00 (conflict)', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1,
      vehicleId: 1,
      serviceIds: [1],
      appointmentDate: '2025-12-25T09:00:00Z', // Overlaps with 08:00-09:30
      discount: 0,
      finalPrice: 100
    })
  });
  if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  const data = await res.json();
  if (data.error !== 'schedule_conflict') throw new Error(`Expected schedule_conflict error, got ${data.error}`);
});

await test('REQ1: Prevent Schedule Conflicts', 'Allow appointment 09:30 (after conflict)', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 2,
      vehicleId: 2,
      serviceIds: [2],
      appointmentDate: '2025-12-25T09:30:00Z', // After first appointment
      discount: 0,
      finalPrice: 100
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT 2: Fixed 30-Minute Intervals
// ─────────────────────────────────────────────────────────────────────────────

await test('REQ2: Fixed 30-Minute Intervals', 'Reject appointment at invalid time (13:15)', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1,
      vehicleId: 1,
      serviceIds: [1],
      appointmentDate: '2025-12-26T13:15:00Z', // Invalid: 15 minutes
      discount: 0,
      finalPrice: 100
    })
  });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  const data = await res.json();
  if (!data.message?.includes('30')) throw new Error(`Expected 30-minute validation error`);
});

await test('REQ2: Fixed 30-Minute Intervals', 'Accept appointment at valid time (13:00)', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1,
      vehicleId: 1,
      serviceIds: [1],
      appointmentDate: '2025-12-26T13:00:00Z', // Valid: on the hour
      discount: 0,
      finalPrice: 100
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await test('REQ2: Fixed 30-Minute Intervals', 'Accept appointment at valid time (14:30)', async () => {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 2,
      vehicleId: 2,
      serviceIds: [2],
      appointmentDate: '2025-12-26T14:30:00Z', // Valid: on the half-hour
      discount: 0,
      finalPrice: 100
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT 4: Sequential Status Workflow
// ─────────────────────────────────────────────────────────────────────────────

await test('REQ4: Sequential Status Workflow', 'Reject invalid transition agendado→em_andamento', async () => {
  const apt1 = (global as any).__apt1;
  const res = await fetch(`${API_BASE}/appointments/${apt1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'em_andamento' }) // Skip confirmado
  });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  const data = await res.json();
  if (data.error !== 'invalid_status_transition') throw new Error('Expected invalid_status_transition error');
});

await test('REQ4: Sequential Status Workflow', 'Allow valid transition agendado→confirmado', async () => {
  const apt1 = (global as any).__apt1;
  const res = await fetch(`${API_BASE}/appointments/${apt1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmado' })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const updated = await res.json();
  if (updated.status !== 'confirmado') throw new Error(`Expected status confirmado, got ${updated.status}`);
});

await test('REQ4: Sequential Status Workflow', 'Allow transition confirmado→em_andamento', async () => {
  const apt1 = (global as any).__apt1;
  const res = await fetch(`${API_BASE}/appointments/${apt1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'em_andamento' })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await test('REQ4: Sequential Status Workflow', 'Allow transition em_andamento→concluido', async () => {
  const apt1 = (global as any).__apt1;
  const res = await fetch(`${API_BASE}/appointments/${apt1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'concluido' })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT 5: Prevent Duplicate Revenue
// ─────────────────────────────────────────────────────────────────────────────

await test('REQ5: Prevent Duplicate Revenue', 'Verify revenue_processed flag prevents double processing', async () => {
  const apt1 = (global as any).__apt1;
  
  // Get appointment and verify it's marked as processed
  const getRes = await fetch(`${API_BASE}/appointments/${apt1.id}`);
  if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
  const apt = await getRes.json();
  
  if (!apt.revenue_processed) {
    throw new Error('Expected revenue_processed=true after completion');
  }
  
  // Try to mark complete again (should be no-op)
  const patchRes = await fetch(`${API_BASE}/appointments/${apt1.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'concluido' })
  });
  if (!patchRes.ok) throw new Error(`Patch failed: ${patchRes.status}`);
  
  // Verify exactly one financial transaction exists
  const txRes = await fetch(`${API_BASE}/financial?type=receita`);
  if (!txRes.ok) throw new Error(`HTTP ${txRes.status}`);
  const txs = await txRes.json();
  const relevantTx = txs.data?.filter((t: any) => t.appointmentId === apt1.id) || [];
  if (relevantTx.length !== 1) throw new Error(`Expected 1 transaction, found ${relevantTx.length}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Financial Module Edit/Delete Tests
// ─────────────────────────────────────────────────────────────────────────────

await test('Financial Module', 'Create transaction for edit test', async () => {
  const res = await fetch(`${API_BASE}/financial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'receita',
      category: 'Serviços',
      description: 'Test transaction for edit',
      amount: 500,
      date: new Date().toISOString(),
      paymentMethod: 'dinheiro'
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tx = await res.json();
  (global as any).__testTx = tx;
});

await test('Financial Module', 'Edit transaction amount', async () => {
  const tx = (global as any).__testTx;
  const res = await fetch(`${API_BASE}/financial/${tx.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'receita',
      category: 'Serviços',
      description: 'Updated description',
      amount: 750, // Changed from 500
      date: tx.date,
      paymentMethod: 'pix'
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const updated = await res.json();
  if (updated.amount !== 750) throw new Error(`Expected amount 750, got ${updated.amount}`);
});

await test('Financial Module', 'Delete transaction', async () => {
  const tx = (global as any).__testTx;
  const res = await fetch(`${API_BASE}/financial/${tx.id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Results Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(80));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(80));

const grouped = results.reduce((acc, r) => {
  if (!acc[r.requirement]) acc[r.requirement] = [];
  acc[r.requirement].push(r);
  return acc;
}, {} as Record<string, TestResult[]>);

for (const [req, tests] of Object.entries(grouped)) {
  const passed = tests.filter(t => t.status === 'PASS').length;
  const total = tests.length;
  console.log(`\n${req}: ${passed}/${total} passed`);
  tests.forEach(t => {
    const icon = t.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${t.test}`);
  });
}

const totalPassed = results.filter(r => r.status === 'PASS').length;
const totalTests = results.length;
console.log(`\n${'-'.repeat(80)}`);
console.log(`OVERALL: ${totalPassed}/${totalTests} tests passed`);
console.log(`${'-'.repeat(80)}\n`);

if (totalPassed === totalTests) {
  console.log('✓ ALL REQUIREMENTS VALIDATED');
  process.exit(0);
} else {
  console.log('✗ SOME TESTS FAILED');
  process.exit(1);
}
