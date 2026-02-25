import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:5173/');

    // Click start and load the sub bass preset
    await page.evaluate(async () => {
        document.getElementById('btn-master-play').click();
        await new Promise(r => setTimeout(r, 500));

        const presetChip = document.querySelector('.toolbar-section-chip[data-section="preset"]');
        presetChip?.click();
        const presetPanel = document.querySelector('.toolbar-section-panel[data-section="preset"]');
        const presetSelect = presetPanel?.querySelector('select');
        presetSelect.value = 'sci-fi-fm';

        const btns = presetPanel?.querySelectorAll('.control-btn') || [];
        for (let btn of btns) {
            if (btn.textContent === 'LOAD PRESET') {
                btn.click();
            }
        }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Take screenshot of the whole page to see the loaded preset and the top bar
    await page.screenshot({ path: '/Users/tyler/.gemini/antigravity/brain/af427ddc-b417-4e18-a161-cf44819f552b/jeskola_preset_menu.png' });

    await browser.close();
})();
