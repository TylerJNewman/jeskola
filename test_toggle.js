import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:5173/');

    // Click start and add an oscillator
    await page.evaluate(async () => {
        document.getElementById('btn-master-play').click();
        await new Promise(r => setTimeout(r, 500));
        const btns = document.querySelectorAll('.add-module-btn');
        btns[0].click(); // Osc 1
    });

    await new Promise(r => setTimeout(r, 1000));

    const oscModule = await page.$('.module[data-id]');

    // 1. Take screenshot of PITCH mode (default)
    await oscModule.screenshot({ path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_osc_pitch_mode.png' });

    // 2. Click FREQ mode toggle
    await page.evaluate(() => {
        const freqToggle = document.querySelector('.segment[data-mode="freq"]');
        freqToggle.click();
    });

    await new Promise(r => setTimeout(r, 500));

    // 3. Take screenshot of FREQ mode
    await oscModule.screenshot({ path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_osc_freq_mode.png' });

    await browser.close();
})();
