// Tests fonctionnels et visuels des pages assemblées, dans un vrai Chrome.
// Architecture testée : zéro JavaScript, une vraie page par langue (traductions au build),
// menu mobile en case à cocher, galeries scroll-snap, grille CSS pure (layout.css).
// La grille est comparée à metrics-before.json (capturé sur main, commit 6fa0468).
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = "http://127.0.0.1:8642";
const SCRATCH = __dirname;
const REPO = path.join(__dirname, "..");
const TOL = 6; // tolérance en px pour la comparaison de grille ("quelques px")

// Premier navigateur Chromium disponible sur la machine
const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ...(() => {
    const pw = path.join(process.env.HOME, "Library/Caches/ms-playwright");
    try {
      return fs.readdirSync(pw)
        .filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
        .map((d) => path.join(pw, d, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"));
    } catch { return []; }
  })(),
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error("Aucun Chromium trouvé"); process.exit(2); }

// Les traductions font foi : les attendus viennent des mêmes JSON que le build
const i18n = {};
for (const lang of ["fr", "en", "de", "es", "zh"])
  i18n[lang] = JSON.parse(fs.readFileSync(path.join(REPO, "_data/i18n", lang + ".json"), "utf8"));

let failures = 0;
function check(cond, label, extra) {
  if (cond) console.log("ok  " + label);
  else { console.error("ECHEC " + label + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); failures++; }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  console.log("navigateur:", CHROME);

  const externalRequests = [];
  const failedLocal = [];
  const localJsRequests = [];
  const consoleErrors = [];

  async function newPage(width, height) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith(BASE) || url.startsWith("data:")) {
        if (url.startsWith(BASE) && (url.split("?")[0].endsWith(".js") || req.resourceType() === "script"))
          localJsRequests.push(url);
        req.continue();
      } else { externalRequests.push(url); req.abort(); }
    });
    page.on("response", (res) => {
      if (res.url().startsWith(BASE) && res.status() >= 400) failedLocal.push(res.status() + " " + res.url());
    });
    // Les "Failed to load resource" viennent des requêtes externes bloquées par le test
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("Failed to load resource"))
        consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    return page;
  }

  const jsonLd = (page) => page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
  );
  const flagLinks = (page) => page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("#footer a[hreflang]")].map((a) => [a.getAttribute("hreflang"), a.getAttribute("href")]))
  );
  const navText = (page, cls) => page.evaluate((c) => document.querySelector("#nav li." + c + " a").textContent.trim(), cls);

  // ---- Accueil français : / ----
  let page = await newPage(1280, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  check(await page.evaluate(() => document.documentElement.lang) === "fr", "home fr: <html lang='fr'>");
  check((await page.title()) === i18n.fr.header.trim(), "home fr: title = i18n.fr.header", await page.title());
  check(await navText(page, "chambres") === i18n.fr.chambres, "home fr: nav Chambres en français");
  const hreflangs = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href]))
  );
  check(["fr", "en", "de", "es", "zh", "x-default"].every((h) => hreflangs[h]), "home fr: 6 hreflang présents", hreflangs);
  check(hreflangs.en === "https://la-villa-paris.com/en/", "home fr: hreflang en -> /en/", hreflangs.en);
  const canonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]').href);
  check(canonical === "https://la-villa-paris.com/", "home fr: canonical /", canonical);
  const ld = (await jsonLd(page)).map((d) => d["@type"]);
  check(ld.includes("BedAndBreakfast"), "home fr: JSON-LD BedAndBreakfast", ld);
  check(await page.evaluate(() => document.fonts.check('16px "Source Sans Pro"')), "home fr: police Source Sans Pro chargée (auto-hébergée)");
  const iconInfo = await page.evaluate(() =>
    [...document.querySelectorAll(".icon.major")].map((el) => {
      const s = getComputedStyle(el, "::before");
      return { mask: (s.webkitMaskImage || s.maskImage || "none") !== "none", w: s.width };
    })
  );
  check(iconInfo.length === 3 && iconInfo.every((i) => i.mask && parseInt(i.w) > 20), "home fr: 3 icônes SVG rendues", iconInfo);
  const homeFlags = await flagLinks(page);
  check(homeFlags.fr === "/" && homeFlags.en === "/en/" && homeFlags.de === "/de/" && homeFlags.es === "/es/" && homeFlags.zh === "/zh/",
    "home fr: drapeaux -> accueils des 5 langues", homeFlags);
  for (const f of ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"]) {
    const status = await page.evaluate(async (u) => (await fetch(u)).status, f);
    check(status === 200, "favicon " + f + " -> 200");
  }
  await page.screenshot({ path: SCRATCH + "/shot-home-desktop.png" });

  // Choix de langue explicite : le clic sur un drapeau pose le cookie nf_lang, que Netlify
  // consulte pour ses conditions Language (sinon un navigateur anglophone qui choisit le
  // français serait re-redirigé / -> /en/ par netlify.toml, force = true)
  // (pas de waitForNavigation/waitForFunction : l'activation du prérendu des speculation rules
  // remplace la cible en cours de route et les fait résoudre trop tôt ou planter)
  await page.click("#footer a#english");
  await new Promise((r) => setTimeout(r, 1500));
  check(await page.evaluate(() => location.pathname) === "/en/", "drapeau: clic drapeau anglais depuis la home -> /en/", page.url());
  check(await page.evaluate(() => document.cookie.includes("nf_lang=en")),
    "drapeau: cookie nf_lang posé au clic (contre la re-redirection Netlify)", await page.evaluate(() => document.cookie));

  // ---- Accueil anglais servi par le serveur : /en/ (le texte est dans le HTML brut) ----
  const rawEn = await page.evaluate(async (u) => await (await fetch(u)).text(), BASE + "/en/");
  check(rawEn.includes('lang="en"'), "en: <html lang='en'> dans le HTML brut");
  check(rawEn.includes(">" + i18n.en.chambres + "<"), "en: '" + i18n.en.chambres + "' dans le HTML brut (traduction au build, pas au client)");
  await page.goto(BASE + "/en/", { waitUntil: "networkidle0" });
  check((await page.title()) === i18n.en.header.trim(), "en: title anglais", await page.title());
  check(await page.evaluate(() => document.querySelector('link[rel="canonical"]').href) === "https://la-villa-paris.com/en/", "en: canonical /en/");

  // ---- Chambres en allemand : /de/chambres ----
  await page.goto(BASE + "/de/chambres", { waitUntil: "networkidle0" });
  check(await page.evaluate(() => document.documentElement.lang) === "de", "de/chambres: <html lang='de'>");
  check(await navText(page, "chambres") === "Zimmer", "de/chambres: nav 'Zimmer'");
  check((await page.title()).startsWith(i18n.de.chambres), "de/chambres: title allemand", await page.title());
  const deFlags = await flagLinks(page);
  check(deFlags.fr === "/chambres" && deFlags.en === "/en/chambres" && deFlags.zh === "/zh/chambres",
    "de/chambres: drapeaux -> même page dans chaque langue", deFlags);
  const deNav = await page.evaluate(() => [...document.querySelectorAll("#nav a")].map((a) => a.getAttribute("href")));
  check(deNav.every((h) => h === "/de/" || h.startsWith("/de/")), "de/chambres: liens du nav préfixés /de", deNav);

  // ---- FAQ chinoise : /zh/faq + JSON-LD FAQPage ----
  await page.goto(BASE + "/zh/faq", { waitUntil: "networkidle0" });
  check(await page.evaluate(() => document.documentElement.lang) === "zh", "zh/faq: <html lang='zh'>");
  check(await page.evaluate(() => document.body.textContent.includes("常见问题")), "zh/faq: contenu chinois (常见问题)");
  let faqLd = (await jsonLd(page)).find((d) => d["@type"] === "FAQPage");
  check(!!faqLd && Array.isArray(faqLd.mainEntity) && faqLd.mainEntity.length >= 3,
    "zh/faq: JSON-LD FAQPage valide avec questions", faqLd && faqLd.mainEntity && faqLd.mainEntity.length);
  check(!!faqLd && /[一-鿿]/.test(faqLd.mainEntity[0].name) && /[一-鿿]/.test(faqLd.mainEntity[0].acceptedAnswer.text),
    "zh/faq: questions/réponses du JSON-LD en chinois", faqLd && faqLd.mainEntity[0]);

  // ---- FAQ anglaise : JSON-LD dans la langue de la page ----
  await page.goto(BASE + "/en/faq", { waitUntil: "networkidle0" });
  faqLd = (await jsonLd(page)).find((d) => d["@type"] === "FAQPage");
  check(!!faqLd && faqLd.mainEntity.length >= 3 && !/[一-鿿]/.test(faqLd.mainEntity[0].name),
    "en/faq: JSON-LD FAQPage en anglais", faqLd && faqLd.mainEntity && faqLd.mainEntity[0] && faqLd.mainEntity[0].name);

  // ---- Photos espagnoles : stub d'une autre langue ----
  await page.goto(BASE + "/es/photos", { waitUntil: "networkidle0" });
  check(await page.evaluate(() => document.documentElement.lang) === "es", "es/photos: <html lang='es'>");

  // ---- Photos : galeries scroll-snap pilotées par le dossier images ----
  await page.goto(BASE + "/photos", { waitUntil: "networkidle0" });
  const gal = await page.evaluate(() => {
    const shows = [...document.querySelectorAll(".slideshow")];
    const imgs = shows.flatMap((s) => [...s.querySelectorAll("img")]);
    const first = shows[0];
    const s = first && getComputedStyle(first);
    return {
      slideshows: shows.length,
      images: imgs.length,
      lazy: imgs.every((i) => i.loading === "lazy"),
      alts: imgs.every((i) => i.alt.trim().length > 0),
      // width/height + decoding : l'espace est réservé avant chargement (pas de saut de
      // page, le fond shimmer de layout.css reste visible pendant le téléchargement)
      dims: imgs.every((i) => parseInt(i.getAttribute("width")) > 0 && parseInt(i.getAttribute("height")) > 0),
      async: imgs.every((i) => i.decoding === "async"),
      shimmer: getComputedStyle(imgs[0]).animationName !== "none",
      snapType: s && s.scrollSnapType,
      imgAlign: first && getComputedStyle(first.querySelector("img")).scrollSnapAlign,
      overflows: first && first.scrollWidth > first.clientWidth + 10,
      // affordance : la 4e photo doit être partiellement visible (coupée au bord droit).
      // NB : la scrollbar custom toujours visible ne peut pas être testée ici, puppeteer
      // lance headless avec --hide-scrollbars (vérifiée manuellement, offsetH-clientH = 8).
      peek: (() => {
        const r = first.getBoundingClientRect(), i4 = first.querySelectorAll("img")[3];
        if (!i4) return false;
        const b = i4.getBoundingClientRect();
        return b.left < r.right && b.right > r.right;
      })(),
    };
  });
  check(gal.peek, "photos: 4e photo partiellement visible (signale le défilement)", gal.peek);
  check(gal.images >= 95, "photos: ~101 images dans les galeries (" + gal.images + ")", gal.images);
  check(gal.lazy && gal.alts, "photos: images lazy + alt renseignés", { lazy: gal.lazy, alts: gal.alts });
  check(gal.dims && gal.async, "photos: width/height + decoding=async (espace réservé, pas de saut)", { dims: gal.dims, async: gal.async });
  check(gal.shimmer, "photos: fond shimmer actif pendant le chargement", gal.shimmer);
  check(/x/.test(gal.snapType || "") && gal.imgAlign === "start" && gal.overflows,
    "photos: scroll-snap natif sur les galeries", gal);
  const snapped = await page.evaluate(async () => {
    const el = document.querySelector(".slideshow");
    el.scrollTo({ left: el.querySelector("img").getBoundingClientRect().width * 0.6, behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 800));
    const base = el.querySelectorAll("img")[0].offsetLeft;
    const offsets = [...el.querySelectorAll("img")].map((i) => i.offsetLeft - base);
    return Math.min(...offsets.map((o) => Math.abs(o - el.scrollLeft)));
  });
  check(snapped <= 3, "photos: le défilement s'accroche sur une image (écart " + snapped + "px)");
  // Toutes les images de la page existent bien sur le disque (le lazy-loading masquerait un 404)
  const imgStatuses = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll(".slideshow img")].map((i) => i.getAttribute("src"));
    const bad = [];
    for (const u of urls) { const r = await fetch(u, { method: "HEAD" }); if (r.status !== 200) bad.push(r.status + " " + u); }
    return bad;
  });
  check(imgStatuses.length === 0, "photos: toutes les images des galeries existent (HEAD 200)", imgStatuses);
  await page.close();

  // ---- Mobile 375px : menu hamburger en case à cocher, sans JavaScript ----
  page = await newPage(375, 667);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const toggle = await page.$("label.nav-toggle");
  check(!!toggle, "mobile: label.nav-toggle présent");
  if (toggle) {
    const box = await toggle.boundingBox();
    check(box && box.width >= 44 && box.height >= 40, "mobile: zone tactile du hamburger", box);
    const icon = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector("label.nav-toggle"), "::before");
      return { mask: (s.webkitMaskImage || s.maskImage || "none") !== "none", bg: s.backgroundColor };
    });
    check(icon.mask, "mobile: icône hamburger visible (mask SVG)", icon);
    check(await page.evaluate(() => getComputedStyle(document.querySelector("#nav")).display) === "none",
      "mobile: menu fermé au chargement");
    await page.screenshot({ path: SCRATCH + "/shot-mobile-closed.png" });
    await toggle.tap();
    await new Promise((r) => setTimeout(r, 300));
    const panel = await page.evaluate(() => {
      const nav = document.querySelector("#nav");
      const b = nav.getBoundingClientRect();
      return {
        display: getComputedStyle(nav).display, top: b.top, w: b.width,
        checked: document.querySelector("#nav-toggle").checked,
        links: [...nav.querySelectorAll("a")].map((a) => a.textContent.trim()),
        liDisplay: [...nav.querySelectorAll("ul > li")].map((li) => getComputedStyle(li).display),
        linkTops: [...nav.querySelectorAll("a")].map((a) => Math.round(a.getBoundingClientRect().top)),
      };
    });
    check(panel.checked && panel.display === "block" && panel.links.length === 5,
      "mobile: le hamburger ouvre le menu (5 liens)", panel);
    check(panel.liDisplay.every((d) => d === "block") && panel.linkTops.every((t, i) => i === 0 || t > panel.linkTops[i - 1]),
      "mobile: entrées du menu empilées verticalement (pas le style desktop)", panel.linkTops);
    check(panel.links.includes(i18n.fr.faq), "mobile: lien FAQ dans le menu", panel.links);
    check(panel.top >= 43 && panel.w >= 370, "mobile: le panneau s'affiche sous la barre, pleine largeur", panel);
    await page.screenshot({ path: SCRATCH + "/shot-mobile-open.png" });
    await toggle.tap();
    await new Promise((r) => setTimeout(r, 300));
    check(await page.evaluate(() => getComputedStyle(document.querySelector("#nav")).display) === "none",
      "mobile: le hamburger referme le menu");
  }

  // Marges latérales, débordement, recouvrement par la barre fixe de 44px
  const layout = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".container"));
    return {
      padLeft: parseInt(s.paddingLeft), padRight: parseInt(s.paddingRight),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      headerTop: document.querySelector("#header h1").getBoundingClientRect().top,
    };
  });
  check(layout.padLeft >= 16 && layout.padRight >= 16, "mobile: padding latéral du contenu", layout);
  check(layout.overflow <= 1, "mobile: pas de défilement horizontal", layout);
  check(layout.headerTop >= 44, "mobile: le titre n'est pas recouvert par la barre (44px)", layout.headerTop);
  await page.close();

  // ---- Grille : comparaison avec l'état AVANT dé-skellisation (metrics-before.json) ----
  // Attendu identique au pixel près (TOL couvre les arrondis) ; le row-gap vertical ajouté
  // par layout.css n'apparaît pas ici (on ne compare que largeurs et positions horizontales).
  const before = JSON.parse(fs.readFileSync(SCRATCH + "/metrics-before.json", "utf8"));
  const after = {};
  page = await newPage(1440, 900);
  for (const pageName of ["", "chambres"]) {
    for (const w of [1440, 1100, 900, 800, 600, 375]) {
      await page.setViewport({ width: w, height: 900 });
      await page.goto(BASE + "/" + pageName, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 200));
      const m = await page.evaluate(() => {
        const pick = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), x: Math.round(el.getBoundingClientRect().x) } : null;
        return {
          container: pick(document.querySelector(".container")),
          cols: [...document.querySelectorAll(".row > *")].slice(0, 8).map(pick),
          bodyFont: getComputedStyle(document.body).fontSize,
          hscroll: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      const key = `${pageName || "home"}@${w}`;
      after[key] = m;
      const ref = before[key];
      const diffs = [];
      if (Math.abs(m.container.w - ref.container.w) > TOL || Math.abs(m.container.x - ref.container.x) > TOL)
        diffs.push({ what: "container", before: ref.container, after: m.container });
      ref.cols.forEach((rc, i) => {
        const ac = m.cols[i];
        if (!ac || Math.abs(ac.w - rc.w) > TOL || Math.abs(ac.x - rc.x) > TOL)
          diffs.push({ what: "col" + i, before: rc, after: ac || null });
      });
      if (m.bodyFont !== ref.bodyFont) diffs.push({ what: "bodyFont", before: ref.bodyFont, after: m.bodyFont });
      check(diffs.length === 0, "grille " + key + " identique à l'avant (±" + TOL + "px)", diffs.slice(0, 4));
      check(m.hscroll <= 1, "grille " + key + ": pas de défilement horizontal", m.hscroll);
    }
  }
  fs.writeFileSync(SCRATCH + "/metrics-after.json", JSON.stringify(after, null, 1));
  await page.close();

  // ---- Hygiène réseau : zéro JavaScript, zéro 404 local ----
  check(localJsRequests.length === 0, "aucune requête JavaScript locale (site sans JS)", localJsRequests);
  const badLocal = [...new Set(failedLocal)];
  check(badLocal.length === 0, "aucune requête locale en erreur", badLocal);
  const extHosts = [...new Set(externalRequests.map((u) => new URL(u).host))];
  const allowedExt = (h) => h.includes("googletagmanager") || h.includes("r9cdn.net");
  check(extHosts.every(allowedExt), "seules requêtes externes attendues (gtag, badge Kayak)", extHosts);
  check(consoleErrors.length === 0, "aucune erreur console", consoleErrors.slice(0, 5));
  console.log("requêtes externes bloquées pendant le test:", extHosts);

  await browser.close();
  console.log(failures ? `\n${failures} ECHEC(S)` : "\ntous les tests passent");
  process.exit(failures ? 1 : 0);
})();
