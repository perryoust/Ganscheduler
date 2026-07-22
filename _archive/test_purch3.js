const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});
  const result = await page.evaluate(() => {
    try {
      window.switchMode('purch');
      return 'SUCCESS';
    } catch (e) {
      return 'ERROR: ' + e.toString() + '\\n' + e.stack;
    }
  });
  console.log('Result:', result);
  const bodyClass = await page.evaluate(() => document.body.className);
  console.log('Body class after switchMode:', bodyClass);
  await browser.close();
})();
