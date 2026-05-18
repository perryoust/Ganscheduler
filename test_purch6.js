const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});
  
  const result = await page.evaluate(() => {
    try {
      document.getElementById('modeBtn-purch').click();
      return 'SUCCESS';
    } catch (e) {
      return 'ERROR: ' + e.toString() + '\\n' + e.stack;
    }
  });
  console.log('Result:', result);
  
  await new Promise(r => setTimeout(r, 500));
  const bodyClass = await page.evaluate(() => document.body.className);
  console.log('Body class after click:', bodyClass);
  
  await browser.close();
})();
