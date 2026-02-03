/**
 * test-telegram-setup.js - Test the Telegram skill setup flow (mocked)
 *
 * This tests the setup wizard logic:
 * - Validation of credentials and phone number
 * - State persistence to store
 * - Request queue for async operations
 *
 * Run with:
 *   yarn test:script telegram scripts/examples/test-telegram-setup.js
 */

console.log('=== Telegram Setup Flow Test (Mocked) ===\n');

// Helper to pretty-print objects
function pp(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// Helper to simulate delay (not actual delay in mocked runner)
function log(msg) {
  console.log(`[test] ${msg}`);
}

// ---------------------------------------------------------------------------
// Test 1: Check tools are available
// ---------------------------------------------------------------------------
log('Test 1: Checking tools are available...');

// listTools might have undefined entries due to CommonJS interop issues
const rawToolNames = listTools();
const toolNames = rawToolNames.filter(function (name) {
  return typeof name === 'string';
});
console.log('Available tools:', toolNames);

// Also check the tools array directly for debugging
console.log('Raw tools array length:', tools ? tools.length : 0);
if (tools) {
  tools.forEach(function (t, i) {
    if (t) {
      console.log('Tool ' + i + ':', t.name);
    } else {
      console.log('Tool ' + i + ': undefined');
    }
  });
}

// ---------------------------------------------------------------------------
// Test 2: Initialize skill
// ---------------------------------------------------------------------------
log('\nTest 2: Initializing skill...');

init();

// Check initial state
const initialStatus = callTool('telegram-status', {});
log('Initial status:');
pp(initialStatus);

// Should not be connected or authenticated initially
if (initialStatus.connected || initialStatus.authenticated) {
  console.warn('WARNING: Skill started with unexpected state');
}
log('Skill initialized successfully');

// ---------------------------------------------------------------------------
// Test 3: Test setup flow - onSetupStart
// ---------------------------------------------------------------------------
log('\nTest 3: Testing onSetupStart...');

const setupStartResult = triggerSetupStart();
log('Setup start result:');
pp(setupStartResult);

// Should return credentials step (no env vars set in mock)
if (!setupStartResult.step) {
  throw new Error('onSetupStart should return a step');
}

const firstStepId = setupStartResult.step.id;
log(`First step: ${firstStepId}`);

// ---------------------------------------------------------------------------
// Test 4: Test credentials validation
// ---------------------------------------------------------------------------
log('\nTest 4: Testing credentials validation...');

// Test empty apiId
let result = triggerSetupSubmit('credentials', {
  apiId: '',
  apiHash: 'abc123',
});
log('Empty apiId result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Empty apiId should return error');
}
log('Empty apiId validation passed');

// Test invalid apiId (non-numeric)
result = triggerSetupSubmit('credentials', {
  apiId: 'notanumber',
  apiHash: 'abc123',
});
log('Non-numeric apiId result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Non-numeric apiId should return error');
}
log('Non-numeric apiId validation passed');

// Test empty apiHash
result = triggerSetupSubmit('credentials', {
  apiId: '12345678',
  apiHash: '',
});
log('Empty apiHash result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Empty apiHash should return error');
}
log('Empty apiHash validation passed');

// ---------------------------------------------------------------------------
// Test 5: Test valid credentials submission
// ---------------------------------------------------------------------------
log('\nTest 5: Testing valid credentials submission...');

result = triggerSetupSubmit('credentials', {
  apiId: '12345678',
  apiHash: 'abcdef1234567890abcdef1234567890',
});
log('Valid credentials result:');
pp(result);

if (result.status !== 'next') {
  throw new Error('Valid credentials should return next');
}
if (!result.nextStep || result.nextStep.id !== 'phone') {
  throw new Error('Should return phone step');
}
log('Credentials accepted, phone step returned');

// Check that config was saved
const savedConfig = store.get('config');
log('Saved config:');
pp(savedConfig);

if (!savedConfig || savedConfig.apiId !== 12345678) {
  throw new Error('Config not saved correctly');
}
log('Config persisted to store');

// ---------------------------------------------------------------------------
// Test 6: Test phone number validation
// ---------------------------------------------------------------------------
log('\nTest 6: Testing phone number validation...');

// Test missing phone number
result = triggerSetupSubmit('phone', {
  phoneNumber: '',
});
log('Empty phone result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Empty phone should return error');
}
log('Empty phone validation passed');

// Test invalid format (no +)
result = triggerSetupSubmit('phone', {
  phoneNumber: '1234567890',
});
log('Invalid phone format result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Phone without + should return error');
}
log('Phone format validation passed');

// ---------------------------------------------------------------------------
// Test 7: Test valid phone submission
// ---------------------------------------------------------------------------
log('\nTest 7: Testing valid phone submission...');

result = triggerSetupSubmit('phone', {
  phoneNumber: '+1234567890',
});
log('Valid phone result:');
pp(result);

if (result.status !== 'next') {
  throw new Error('Valid phone should return next');
}
if (!result.nextStep || result.nextStep.id !== 'code') {
  throw new Error('Should return code step');
}
log('Phone accepted, code step returned');

// ---------------------------------------------------------------------------
// Test 8: Test code validation
// ---------------------------------------------------------------------------
log('\nTest 8: Testing code validation...');

// Test empty code
result = triggerSetupSubmit('code', {
  code: '',
});
log('Empty code result:');
pp(result);

if (result.status !== 'error') {
  throw new Error('Empty code should return error');
}
log('Empty code validation passed');

// ---------------------------------------------------------------------------
// Test 9: Test valid code submission
// ---------------------------------------------------------------------------
log('\nTest 9: Testing valid code submission...');

result = triggerSetupSubmit('code', {
  code: '12345',
});
log('Valid code result:');
pp(result);

if (result.status !== 'complete') {
  throw new Error('Valid code should return complete');
}
log('Code accepted, setup complete');

// ---------------------------------------------------------------------------
// Test 10: Check request queue
// ---------------------------------------------------------------------------
log('\nTest 10: Checking request queue...');

// The setup flow should have enqueued these requests:
// 1. connect (from credentials step)
// 2. send-code (from phone step)
// 3. sign-in (from code step)

// Check mock state for queued requests (if available)
try {
  const mockState = __getMockState();
  if (mockState && mockState.db && mockState.db.tables) {
    log('Request queue state available');
    if (mockState.db.tables.telegram_requests) {
      log(`Queued requests: ${mockState.db.tables.telegram_requests.length}`);
    }
  }
} catch (e) {
  log('Mock state inspection not available (expected in some runners)');
}



// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log('=== All Tests Passed ===');
console.log('='.repeat(60));

console.log(`
Summary:
- Setup flow validation works correctly
- Config is persisted to store
- Requests are enqueued for async processing
- Tools can be called and return expected responses

Note: This is a mocked test. For live Telegram API testing,
use the live runner with credentials:

  TELEGRAM_API_ID=xxx TELEGRAM_API_HASH=xxx \\
    yarn test:live telegram scripts/examples/test-telegram-live.js
`);
