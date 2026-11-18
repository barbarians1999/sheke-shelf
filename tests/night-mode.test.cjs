const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if ((file !== root && !file.startsWith(root + path.sep)) || /\.(epub|pdf)$|[\\/]\.git/.test(file)) { res.writeHead(403).end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(target)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    if (process.env.SHEKE_TEST_ENGINE && process.env.SHEKE_TEST_ENGINE !== name) continue;
    const browser = await engine.launch({headless:true, ...(name === 'chromium' && process.env.CHROMIUM_CHANNEL ? {channel:process.env.CHROMIUM_CHANNEL} : {})});
    try {
      for (const mobile of [false, true]) {
        const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:900}, isMobile:mobile, hasTouch:mobile, colorScheme:'light' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base);
        await page.locator('.read-button').first().waitFor();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        await page.locator('#theme-toggle').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        await page.reload();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 27, 26)');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No shelf horizontal overflow');
        const shots = process.env.SHEKE_SCREENSHOT_DIR;
        if (shots) await page.screenshot({path:path.join(shots, `${name}-${mobile?'mobile':'desktop'}-night-shelf.png`)});
        await page.locator('.read-button').first().click();
        await page.locator('#chapter-content p').first().waitFor();
        assert.equal(await page.locator('.reading-page').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(28, 31, 29)');
        if (shots) await page.screenshot({path:path.join(shots, `${name}-${mobile?'mobile':'desktop'}-night-reading.png`)});
        if (mobile) await page.locator('#chapter-content p').first().tap();
        await page.locator('#font-settings > summary').click();
        await page.locator('[data-theme-choice="light"]').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        await page.locator('[data-theme-choice="dark"]').click();
        assert.equal(await page.locator('[data-theme-choice="dark"]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-theme-choice="system"]').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
        await page.emulateMedia({colorScheme:'dark'});
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        if (mobile) assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#1c1f1d');
        await page.locator('[data-theme-choice="light"]').click();
        await page.emulateMedia({colorScheme:'light'});
        await page.emulateMedia({colorScheme:'dark'});
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Manual preference overrides system');
        await page.locator('[data-theme-choice="dark"]').click();
        await page.locator('#font-settings > summary').click();
        await page.locator('#toggle-contents').click();
        if (mobile) {
          await page.locator('#close-contents').click();
          if (!await page.locator('#back-button').isVisible()) await page.locator('#chapter-content p').first().tap();
        } else await page.locator('#toggle-contents').click();
        await page.locator('#back-button').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        assert.notEqual(await page.evaluate(() => document.activeElement.id), 'book-search');
        const second = await context.newPage();
        await second.goto(base);
        await page.locator('#theme-toggle').click();
        await second.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`PASS ${name} ${mobile?'mobile':'desktop'}: switch, reload, system, manual, reader, contents, return, cross-tab`);
      }
      const blocked = await browser.newContext({colorScheme:'dark'});
      await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get(){throw new Error('Blocked');}}));
      const page = await blocked.newPage();
      await page.goto(base);
      await page.locator('.read-button').first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.locator('#theme-toggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await blocked.close();
      console.log(`PASS ${name}: storage unavailable`);
    } finally { await browser.close(); }
  }
})().catch(error => {console.error(error); process.exitCode=1;}).finally(() => server.close());
