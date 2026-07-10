// Capture l'état AVANT dé-skellisation : screenshots + métriques de grille
// pour comparer après la réécriture CSS.
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://127.0.0.1:8642";
const SCRATCH = __dirname;
const TAG = process.argv[2] || "before";

const WIDTHS = [1440, 1100, 900, 800, 600, 375];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => (req.url().startsWith(BASE) || req.url().startsWith("data:")) ? req.continue() : req.abort());

  const metrics = {};
  for (const pageName of ["", "chambres"]) {
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: 900 });
      await page.goto(BASE + "/" + pageName, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 300));
      const m = await page.evaluate(() => {
        const pick = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), x: Math.round(el.getBoundingClientRect().x) } : null;
        const cols = [...document.querySelectorAll(".row > *")].slice(0, 8).map(pick);
        return {
          container: pick(document.querySelector(".container")),
          cols,
          bodyFont: getComputedStyle(document.body).fontSize,
          hscroll: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      metrics[`${pageName || "home"}@${w}`] = m;
      await page.screenshot({ path: `${SCRATCH}/ref-${TAG}-${pageName || "home"}-${w}.png`, fullPage: w <= 800 });
    }
  }
  fs.writeFileSync(`${SCRATCH}/metrics-${TAG}.json`, JSON.stringify(metrics, null, 1));
  console.log("métriques et screenshots capturés:", TAG);
  await browser.close();
})();
