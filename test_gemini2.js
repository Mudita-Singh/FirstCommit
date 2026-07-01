// Test script to invoke generateBlockExplanation and print error status
const path = require('path');
const { generateBlockExplanation } = require(path.join(__dirname, 'server/src/services/ai.service'));
(async () => {
  try {
    const code = `const x = 5;\nfunction add(a,b){return a+b;}`;
    const result = await generateBlockExplanation('test.js', code, false);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Caught error status:', err?.response?.status);
    console.error('Full error:', err);
  }
})();
