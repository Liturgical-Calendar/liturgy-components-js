import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', msg => console.log('Browser:', msg.text()));

await page.setViewportSize({ width: 1280, height: 900 });

console.log('Loading WebCalendar example...');
await page.goto('http://localhost:3001/examples/WebCalendar/', {
    waitUntil: 'networkidle',
    timeout: 30000
});

// Wait for the table to appear
console.log('Waiting for calendar table to render...');
try {
    await page.waitForSelector('#LitCalTable', { timeout: 15000 });
    console.log('Table found, waiting for full render...');
    await page.waitForTimeout(3000);
} catch (e) {
    console.log('Table not found after 15s, taking screenshot anyway...');
}

await page.screenshot({
    path: 'docs/images/webcalendar.png',
    fullPage: false
});
console.log('Screenshot saved to docs/images/webcalendar.png');

await browser.close();
