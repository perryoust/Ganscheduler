const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/index.html', {waitUntil: 'networkidle2'});
  const beforeAppMode = await page.evaluate(() => window._appMode);
  await page.click('#modeBtn-purch');
  await new Promise(r => setTimeout(r, 1000));
  const afterAppMode = await page.evaluate(() => window._appMode);
  const _fbUser = await page.evaluate(() => typeof window._fbUser !== 'undefined' ? window._fbUser : 'undefined');
  const logs = await page.evaluate(() => {
     let logs = [];
     if(typeof window.permPurch === 'undefined') logs.push('permPurch is undefined');
     else logs.push('permPurch is ' + window.permPurch);
     return logs;
  });
  console.log('Before App Mode:', beforeAppMode);
  console.log('After App Mode:', afterAppMode);
  console.log('FBUser:', _fbUser);
  console.log('Logs:', logs);
  await browser.close();
})();
