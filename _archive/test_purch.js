const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});
  await page.waitForSelector('#modeBtn-purch');
  await page.click('#modeBtn-purch');
  await new Promise(r => setTimeout(r, 1000));
  const tabsPurch = await page.$eval('#tabs-purch', e => e.style.display);
  const ppdash = await page.$eval('#p-pdash', e => e.style.display);
  console.log('tabs-purch display:', tabsPurch);
  console.log('p-pdash display:', ppdash);
  await browser.close();
})();
