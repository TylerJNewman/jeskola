import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/');

  // Click start and add some modules
  await page.evaluate(async () => {
    document.getElementById('btn-master-play').click();
    await new Promise(r => setTimeout(r, 500));
    const btns = document.querySelectorAll('.add-module-btn');
    btns[0].click(); // Osc 1
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot of the first module (Oscillator)
  const oscModule = await page.$('.module[data-id]'); // The first module that has a data-id
  await oscModule.screenshot({path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_new_osc_ui.png'});

  await browser.close();
})();
