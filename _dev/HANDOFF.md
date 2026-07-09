# Passation : modernisation du site (branche `modernize`)

Document de reprise pour continuer le travail sur une autre machine / une autre session Claude.
Pour reprendre : ouvrir Claude Code dans le repo, branche `modernize`, et dire
"Lis _dev/HANDOFF.md et continue le travail là où il s'est arrêté."

## Contexte

Site Jekyll + Netlify du B&B familial (le père de Nicolas édite le contenu via l'interface web
GitHub, cette contrainte est non négociable). `main` = production (auto-déployée par Netlify).
La branche `modernize` contient les phases M1 à M4 du plan de modernisation, APPLIQUÉES mais
PAS ENTIÈREMENT VÉRIFIÉES (voir "Reste à faire").

## Ce que la branche change (M1+M2+M3+M4 en un seul état cohérent)

1. **Plus aucun JavaScript** (sauf gtag et speculation rules dans le head) :
   - Supprimés : jquery, skel, skel-layers (le framework 2014 qui générait le CSS responsive
     à l'exécution), dropotron (menu déroulant jamais utilisé), slick (carrousel),
     jquery.localize, init.js, `_includes/scripts.html`.
   - `css/layout.css` (nouveau) réimplémente en CSS pur : conteneur par breakpoint, la grille
     historique (classes `4u`, `12u(narrower)`, `row 200%`... via sélecteurs d'attribut),
     le menu mobile hamburger (case à cocher, dans `_includes/header.html`), les galeries
     en scroll-snap natif, les hauteurs de l'iframe beds24 par media query.
   - Les fichiers `style-wide/normal/narrow.css` sont maintenant liés avec un attribut
     `media="(max-width: ...)"` dans head.html (avant : injectés par skel).

2. **Traductions au build (le gros morceau SEO)** :
   - `translation/localize-*.json` (client) → `_data/i18n/{fr,en,de,es,zh}.json` (build).
   - Vraies pages par langue : `/` (fr) + `/en/`, `/de/`, `/es/`, `/zh/` × (accueil, chambres,
     photos, reservation, faq). Stubs dans `en/`, `de/`, `es/`, `zh/` avec `lang` + `pagekey`.
   - Layouts réécrits : textes via `{{ i18n.clé }}`, liens internes préfixés par langue,
     hreflang + canonical dans head.html, `<html lang>` correct, drapeaux du footer = liens.
   - FAQ : `_faq/cn.md` renommé `_faq/zh.md` (lang: zh) ; une page FAQ par langue avec
     JSON-LD FAQPage dans la langue de la page.
   - `netlify.toml` : redirections 302 de `/` selon Accept-Language (force = true obligatoire).
   - IMPORTANT prix : les textes français inline étaient PÉRIMÉS, les JSON (mis à jour par
     le père) font foi. Le passage aux données corrige les prix affichés aux Français.

3. **Divers** : galeries pilotées par le contenu du dossier images (`_includes/gallery.html`,
   le père ajoute une photo en uploadant `imageN.jpg`, N de 1 à 30, sans toucher au HTML),
   sitemap.xml avec les 28 URLs, `_posts`/`about.markdown`/thème minima supprimés,
   `loading="lazy"` + alt sur les images.

## Reste à faire (dans l'ordre)

1. ~~Réécrire `_dev/preview_test.js`~~ **FAIT (session du 2026-07-09)** : suite réécrite pour
   la nouvelle architecture, tout passe (langues serveur, FAQPage par langue, drapeaux,
   hamburger, grille vs metrics-before ±6px, scroll-snap, zéro JS/404/console).
   Trois bugs réels trouvés et corrigés par la même occasion :
   - `css/skel.css` contenait encore les sections Container/Grid statiques de skel
     (gouttières figées 40/80/20px, sélecteurs échappés `.row.\32 00\25` plus spécifiques
     que layout.css) : les lignes `200%`/`50%` avaient une gouttière de 80/20px à TOUTES
     les largeurs. Réduit au reset + box model.
   - `layout.css` était chargé AVANT `style.css`, donc le menu mobile ouvert s'affichait
     avec le style desktop (`display:inline-block`, losange jaune). layout.css est
     maintenant le dernier CSS chargé dans head.html (+ `.container` ne touche plus
     qu'aux marges horizontales pour ne pas écraser le margin-bottom de style-normal.css).
   - `images/photogallery/la-villa-paris/image3.JPG` (extension majuscule) était
     silencieusement ignorée par la galerie : renommée en .jpg, et gallery.html accepte
     désormais aussi `.JPG` (uploads d'appareil photo).
2. **Vérifs déjà faites** (spot-checks à l'assemblage + suite navigateur complète) :
   de/chambres contient "Zimmer" et les prix allemands, zh/faq contient 常见问题,
   photos.html contient 101 images (95 en galeries), hreflang présents.
3. **Deploy preview Netlify** (ouvrir une PR modernize → main) : vérifier les redirections
   Accept-Language (curl -H "Accept-Language: en" doit donner 302 → /en/), le build Jekyll
   réel (le banc local simule Liquid, il ne remplace pas un vrai build), et les 5 langues.
4. Après merge : PageSpeed Insights, Google Search Console (sitemap + hreflang).
5. **Phases restantes du plan** : M5 (images WebP/AVIF + <picture>) et M6 (view transitions,
   en-têtes sécurité, décision analytics sans cookies à discuter avec le père).
6. Mettre à jour `README-FAQ.md` si besoin et prévenir le père : le format FAQ ne change pas,
   mais `cn.md` s'appelle maintenant `zh.md`.

## Le banc de test local (dans `_dev/`)

Pas de build Jekyll possible sur Mac (Gemfile.lock verrouillé sur des gems Linux pour Netlify).
Le banc assemble les pages comme Jekyll (front matter, chaîne de layouts, includes paramétrés,
site.data.i18n, site.static_files, collection _faq) et les teste dans un vrai Chrome.

Prérequis : `brew install ruby` (Ruby moderne), puis gems dans un GEM_HOME local :
`GEM_HOME=$SCRATCH/gems gem install liquid kramdown kramdown-parser-gfm --no-document`
et côté node : `npm install puppeteer-core jsdom` (+ Google Chrome installé).

- `assemble_preview.rb` : assemble les pages dans `_dev/preview/` (liens symboliques vers
  css/js/images/fonts). Liste des pages assemblées : voir `stubs` en bas du script.
- `serve_preview.py 8642` : sert preview/ en mappant `/chambres` → `chambres.html` (comme Netlify).
- `capture_reference.js [tag]` : screenshots + métriques de grille (conteneur, colonnes)
  à 6 largeurs, écrit `metrics-<tag>.json`. `metrics-before.json` = état AVANT (généré sur
  main au commit 6fa0468). `metrics-after.json` = état APRÈS, identique à ±1px.
- `preview_test.js` : suite navigateur complète (réécrite, ~75 assertions, tout passe).
  Sans Chrome installé, les deux scripts node trouvent seuls un Chromium (cache Playwright,
  Brave) ; `CHROME_BIN` permet de forcer un binaire pour capture_reference.js.

Pièges rencontrés (ne pas retomber dedans) :
- Ruby : `$1`/`$2` sont écrasés par tout nouveau match (scan...) : capturer dans des locales
  d'abord. Ce bug a mordu deux fois dans cette session.
- Le tag Liquid `{% include x.html param="..." %}` est du Jekyll, pas du Liquid standard :
  l'assembleur enregistre un tag custom qui l'émule (paramètres avec espaces gérés par regex).
- Les valeurs de gouttières de l'ancienne grille skel : 50px base, 40 ≤1680, 30 ≤1280,
  20 ≤736 ; `row 200%` double, `row 50%` moitié. Vérifié empiriquement dans metrics-before.

## Décisions prises (avec Nicolas)

- Pas de JS sauf si nécessaire pour la galerie (finalement : zéro JS, scroll-snap suffit).
- Exception JS assumée (2026-07-09) : un `onclick` inline par drapeau du footer pose le
  cookie `nf_lang`, que Netlify consulte pour ses conditions `Language`. Sans lui, un
  navigateur anglophone qui clique le drapeau français est re-redirigé / -> /en/
  (force = true) et ne peut jamais atteindre l'accueil français. Le cookie mémorise
  aussi le choix pour les visites suivantes. Test sur le deploy preview :
  `curl -sI -H "Accept-Language: en" -H "Cookie: nf_lang=fr" $BASE/` doit donner 200
  (sans le cookie : 302 -> /en/).
- Chinois : URLs et code langue `zh` (standard), l'ancien code interne était `cn`.
- `merci` et `legal` restent en français uniquement.
- Jekyll + Netlify + édition GitHub conservés, identité visuelle inchangée.
- L'apparence doit rester identique (les métriques de grille font foi), à l'exception
  des corrections assumées : prix à jour, hamburger visible, padding mobile.
