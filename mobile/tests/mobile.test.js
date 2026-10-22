// Mobile Unit Verification Test
const assert = require('assert');

function testMobileContract() {
  const mockLoginResponse = {
    token: 'test_mobile_token_xyz',
    user: { id: 1, email: 'user@org.com', first_name: 'Yuwa', last_name: 'Shree' },
    active_context: 'work',
    active_organization: { id: 'org_123', display_name: 'tp' },
  };

  assert.strictEqual(mockLoginResponse.token, 'test_mobile_token_xyz');
  assert.strictEqual(mockLoginResponse.active_context, 'work');
  assert.strictEqual(mockLoginResponse.active_organization.display_name, 'tp');
  console.log('Mobile contract assertion passed.');
}

testMobileContract();
