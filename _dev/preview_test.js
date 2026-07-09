// Tests fonctionnels et visuels des pages assemblées, dans un vrai Chrome.
const puppeteer = require("puppeteer-core");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://127.0.0.1:8642";
const SCRATCH = __dirname;

let failures = 0;
function check(cond, label, extra) {
  if (cond) console.log("ok  " + label);
  else { console.error("ECHEC " + label + (extra ? " :: " + JSON.stringify(extra) : "")); failures++; }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });

  const externalRequests = [];
  const failedLocal = [];

  async function newPage(width, height) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith(BASE) || url.startsWith("data:")) req.continue();
      else { externalRequests.push(url); req.abort(); }
    });
    page.on("response", (res) => {
      if (res.url().startsWith(BASE) && res.status() >= 400) failedLocal.push(res.status() + " " + res.url());
    });
    return page;
  }

  // ---- Desktop : home ----
  let page = await newPage(1280, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  check((await page.title()) === "La Villa Paris - Bed and Breakfast in Paris - Official Website", "home: title");
  check(await page.evaluate(() => document.fonts.check('16px "Source Sans Pro"')), "home: police Source Sans Pro chargée (auto-hébergée)");

  const iconInfo = await page.evaluate(() =>
    [...document.querySelectorAll(".icon.major")].map((el) => {
      const s = getComputedStyle(el, "::before");
      return { mask: (s.webkitMaskImage || s.maskImage || "none") !== "none", w: s.width, h: s.height };
    })
  );
  check(iconInfo.length === 3 && iconInfo.every((i) => i.mask && parseInt(i.w) > 20), "home: 3 icônes SVG rendues", iconInfo);

  const ld = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)["@type"])
  );
  check(ld.includes("BedAndBreakfast"), "home: JSON-LD BedAndBreakfast valide", ld);

  for (const f of ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"]) {
    const status = await page.evaluate(async (u) => (await fetch(u)).status, f);
    check(status === 200, "favicon " + f + " -> 200");
  }
  await page.screenshot({ path: SCRATCH + "/shot-home-desktop.png" });

  // ---- Persistance de langue : drapeau allemand sur la home, puis navigation ----
  await page.evaluate(() => changeLang("de"));
  await page.goto(BASE + "/chambres", { waitUntil: "networkidle0" });
  const navDe = await page.evaluate(() => document.querySelector('#nav [data-localize="chambres"]').textContent);
  check(navDe === "Zimmer", "persistance: nav en allemand après navigation", navDe);
  check((await page.title()) === "Chambres / Rooms - La Villa Paris", "chambres: title");

  await page.goto(BASE + "/faq", { waitUntil: "networkidle0" });
  const faqVisible = await page.evaluate(() =>
    [...document.querySelectorAll(".faq-lang")].filter((el) => getComputedStyle(el).display !== "none").map((el) => el.dataset.lang)
  );
  check(JSON.stringify(faqVisible) === '["de"]', "persistance: FAQ en allemand", faqVisible);
  check((await page.title()) === "FAQ - La Villa Paris", "faq: title");
  await page.evaluate(() => localStorage.clear());
  await page.close();

  // ---- Mobile : hamburger ----
  page = await newPage(375, 667);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const toggle = await page.$("#titleBar .toggle");
  check(!!toggle, "mobile: #titleBar .toggle présent");
  if (toggle) {
    const box = await toggle.boundingBox();
    check(box && box.width >= 40 && box.height >= 40, "mobile: zone tactile du hamburger", box);
    const icon = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector("#titleBar .toggle"), "::before");
      return { mask: (s.webkitMaskImage || s.maskImage || "none") !== "none", bg: s.backgroundColor };
    });
    check(icon.mask, "mobile: icône hamburger visible (mask SVG)", icon);
    await page.screenshot({ path: SCRATCH + "/shot-mobile-closed.png" });
    await toggle.tap();
    await new Promise((r) => setTimeout(r, 600));
    const panel = await page.evaluate(() => {
      const p = document.querySelector("#navPanel");
      if (!p) return null;
      const b = p.getBoundingClientRect();
      return { x: b.x, w: b.width, links: [...p.querySelectorAll(".link")].map((a) => a.textContent.trim()) };
    });
    check(panel && panel.x >= -5 && panel.links.length >= 5, "mobile: panneau de menu ouvert avec liens", panel);
    check(panel && panel.links.some((t) => t === "FAQ"), "mobile: lien FAQ dans le menu", panel && panel.links);
    await page.screenshot({ path: SCRATCH + "/shot-mobile-open.png" });
    await toggle.tap(); // referme le panneau
    await new Promise((r) => setTimeout(r, 600));
  }

  // Titre non dupliqué : la barre mobile ne doit contenir que le hamburger
  const titleBarText = await page.evaluate(() => document.querySelector("#titleBar").textContent.trim());
  check(titleBarText === "", "mobile: pas de titre dupliqué dans la barre", titleBarText);

  // Marges latérales et absence de débordement horizontal
  const layout = await page.evaluate(() => {
    const c = document.querySelector(".container");
    const s = getComputedStyle(c);
    return {
      padLeft: parseInt(s.paddingLeft), padRight: parseInt(s.paddingRight),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check(layout.padLeft >= 16 && layout.padRight >= 16, "mobile: padding latéral du contenu", layout);
  check(layout.overflow <= 1, "mobile: pas de défilement horizontal", layout);

  // Le contenu ne doit pas passer sous la barre fixe de 44px
  const headerTop = await page.evaluate(() => document.querySelector("#header h1").getBoundingClientRect().top);
  check(headerTop >= 44, "mobile: le titre n'est pas recouvert par la barre", headerTop);
  await page.close();

  // ---- Hygiène réseau ----
  const gfonts = externalRequests.filter((u) => u.includes("fonts.g"));
  check(gfonts.length === 0, "aucune requête Google Fonts", gfonts);
  const badLocal = failedLocal.filter((u) => !u.includes("favicon")); // favicon testé via fetch plus haut
  check(badLocal.length === 0, "aucune requête locale en erreur (404 CSS mobiles corrigés)", badLocal);
  console.log("requêtes externes bloquées pendant le test:", [...new Set(externalRequests.map((u) => new URL(u).host))]);

  await browser.close();
  process.exit(failures ? 1 : 0);
})();
