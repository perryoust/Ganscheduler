const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});
  await page.evaluate(() => window.switchMode('purch'));
  await new Promise(r => setTimeout(r, 500));
  const tabsPurch = await page.$eval('#tabs-purch', e => window.getComputedStyle(e).display);
  const ppdash = await page.$eval('#p-pdash', e => window.getComputedStyle(e).display);
  console.log('Computed tabs-purch display:', tabsPurch);
  console.log('Computed p-pdash display:', ppdash);
  await browser.close();
})();
