import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:5173/');

    // Click start and load ADSR and Oscillator
    await page.evaluate(async () => {
        document.getElementById('btn-master-play').click();
        await new Promise(r => setTimeout(r, 500));

        // add oscillator
        const oscBtn = document.querySelector('.add-module-btn[data-type="oscillator"]');
        oscBtn.click();

        await new Promise(r => setTimeout(r, 100));

        // add ADSR
        const adsrBtn = document.querySelector('.add-module-btn[data-type="adsr"]');
        adsrBtn.click();

        // add Gain
        const gainBtn = document.querySelector('.add-module-btn[data-type="gain"]');
        gainBtn.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    const modules = await page.$$('.module[data-id]');
    // The second module should be ADSR
    if (modules.length > 2) {
        await modules[2].screenshot({ path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_adsr_module.png' });
    }

    await page.screenshot({ path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_adsr_workspace.png' });

    await browser.close();
})();
