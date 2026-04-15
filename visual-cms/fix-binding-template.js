const http = require('http');

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get the binding
  const BINDING_ID = '554014f1-cced-4684-adf9-e0ff1468a04a';
  const { data: binding } = await httpRequest('GET', `/api/data-bindings/${BINDING_ID}`);
  
  console.log('Current config:', JSON.stringify(binding.config, null, 2));
  console.log('Current itemTemplate:', binding.config?.repeaterConfig?.itemTemplate);
  
  // Update itemTemplate to our <a> card
  if (binding.config?.repeaterConfig) {
    binding.config.repeaterConfig.itemTemplate = 'gh-premium-1771840286937-74';
    console.log('New itemTemplate:', binding.config.repeaterConfig.itemTemplate);
    
    const { status, data } = await httpRequest('PUT', `/api/data-bindings/${BINDING_ID}`, {
      config: binding.config
    });
    console.log('Update result:', status, data.id ? 'OK' : JSON.stringify(data));
  }
}

main().catch(console.error);
