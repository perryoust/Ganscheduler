const https = require('https');
const dbBase = 'ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: dbBase,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function migrate() {
  try {
    console.log('Fetching invoices from /data/invoices.json...');
    let inv = await request('GET', '/data/invoices.json');
    if (inv && inv !== 'null') {
      console.log('Saving invoices to /invoices.json (size: ' + inv.length + ' bytes)...');
      await request('PUT', '/invoices.json', inv);
      console.log('Deleting /data/invoices.json...');
      await request('DELETE', '/data/invoices.json');
    }

    console.log('Fetching orders from /data/orders.json...');
    let ord = await request('GET', '/data/orders.json');
    if (ord && ord !== 'null') {
      console.log('Saving orders to /orders.json (size: ' + ord.length + ' bytes)...');
      await request('PUT', '/orders.json', ord);
      console.log('Deleting /data/orders.json...');
      await request('DELETE', '/data/orders.json');
    }

    console.log('Fetching deliveries from /data/deliveries.json...');
    let del = await request('GET', '/data/deliveries.json');
    if (del && del !== 'null') {
      console.log('Saving deliveries to /deliveries.json (size: ' + del.length + ' bytes)...');
      await request('PUT', '/deliveries.json', del);
      console.log('Deleting /data/deliveries.json...');
      await request('DELETE', '/data/deliveries.json');
    }
    
    console.log('Done!');
  } catch(e) {
    console.error(e);
  }
}
migrate();
