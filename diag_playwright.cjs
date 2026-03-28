const { chromium } = require('playwright');

async function testPlaywright() {
  console.log('Testing Playwright Chromium launch from project root...');
  try {
    const browser = await chromium.launch({ headless: true });
    console.log('✅ Playwright launched successfully');
    const page = await browser.newPage();
    await page.goto('https://www.google.com');
    console.log('✅ Navigation to Google successful');
    console.log('Page title:', await page.title());
    await browser.close();
  } catch (err) {
    console.error('❌ Playwright launch failed:', err.message);
    if (err.message.includes('executable')) {
      console.log('💡 TIP: You might need to run `npx playwright install`');
    }
  }
}

testPlaywright();
