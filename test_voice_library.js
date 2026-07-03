import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

async function clickSection(page, label) {
  await page.evaluate((sectionLabel) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find(el => (el.textContent || '').trim().toLowerCase() === sectionLabel.toLowerCase())
    button?.click()
  }, label)
}

async function loadPreset(page, labelContains) {
  await clickSection(page, 'Preset')
  await page.waitForSelector('[data-testid="preset-select"]')
  await page.evaluate((needle) => {
    const select = document.querySelector('[data-testid="preset-select"]')
    if (!(select instanceof HTMLSelectElement)) throw new Error('Preset select missing')
    const options = Array.from(select.options)
    const picked = options.find(o => (o.textContent || '').toLowerCase().includes(needle.toLowerCase()))
      || options.find(o => o.value)
    if (!picked) throw new Error('No preset option available')
    select.value = picked.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, labelContains)
  await page.click('[data-testid="preset-load"]')
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length >= 3)
  await new Promise(resolve => setTimeout(resolve, 200))
}

async function selectFirstModule(page) {
  const nodes = await page.$$('.react-flow__node:not([data-id="master"])')
  if (nodes.length < 1) throw new Error('Need at least one module to build selection')
  await nodes[0].click()
  await new Promise(resolve => setTimeout(resolve, 80))
}

(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })

    await clickSection(page, 'Voice')
    await page.waitForSelector('[data-testid="voice-save-selection"]')

    const initiallyDisabled = await page.$eval('[data-testid="voice-save-selection"]', el => el.disabled)
    assert.equal(initiallyDisabled, true, 'Save Selection should be disabled when nothing is selected')

    await loadPreset(page, 'classic mono lead')
    await clickSection(page, 'Preset')
    await selectFirstModule(page)
    await clickSection(page, 'Voice')

    const enabledAfterSelect = await page.$eval('[data-testid="voice-save-selection"]', el => !el.disabled)
    assert.equal(enabledAfterSelect, true, 'Save Selection should enable after selecting a module')

    await page.type('[data-testid="voice-name-input"]', 'Lead Layer')
    await page.click('[data-testid="voice-save-selection"]')
    await page.waitForFunction(() => (document.querySelector('[data-testid="voice-message"]')?.textContent || '').includes('Saved'))

    const savedItemText = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-testid^="voice-item-"] button'))
      return items.map(el => el.textContent?.trim() || '')
    })
    assert.ok(savedItemText.some(text => text.startsWith('Lead Layer')), 'Expected saved voice in library')

    const beforeApplyCount = await page.$$eval('.react-flow__node:not([data-id="master"])', nodes => nodes.length)
    await page.evaluate(() => {
      const firstApply = Array.from(document.querySelectorAll('[data-testid^="voice-item-"]'))
        .map(card => Array.from(card.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Apply'))
        .find(btn => btn?.textContent?.trim() === 'Apply')
      firstApply?.click()
    })
    await new Promise(resolve => setTimeout(resolve, 220))
    const afterApplyCount = await page.$$eval('.react-flow__node:not([data-id="master"])', nodes => nodes.length)
    assert.ok(afterApplyCount > beforeApplyCount, 'Applying saved voice should add modules')

    await page.reload({ waitUntil: 'networkidle0' })
    await clickSection(page, 'Voice')
    await page.waitForSelector('[data-testid="voice-drawer"]')
    const persists = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="voice-item-"] button'))
        .some(el => (el.textContent || '').toLowerCase().includes('lead layer'))
    )
    assert.equal(persists, true, 'Saved voice should persist after reload')

    page.on('dialog', async dialog => {
      await dialog.accept()
    })
    await page.evaluate(() => {
      const firstDelete = Array.from(document.querySelectorAll('[data-testid^="voice-item-"]'))
        .map(card => Array.from(card.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Delete'))
        .find(Boolean)
      firstDelete?.click()
    })
    await new Promise(resolve => setTimeout(resolve, 120))
    const deleted = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('[data-testid^="voice-item-"] button'))
        .some(el => (el.textContent || '').toLowerCase().includes('lead layer'))
    )
    assert.equal(deleted, true, 'Voice should be removed after delete')

    console.log('Voice library integration test passed')
  } finally {
    await browser.close()
  }
})().catch((err) => {
  console.error('Voice library integration test failed:', err)
  process.exit(1)
})
