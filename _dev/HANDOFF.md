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

1. **Réécrire `_dev/preview_test.js`** : c'est encore l'ANCIENNE version (elle teste
   `changeLang`/localStorage qui n'existent plus). À tester sur la nouvelle architecture :
   - `/` fr, `/en/` anglais serveur (texte "Rooms" dans le HTML brut), `/de/chambres` allemand,
     `/zh/faq` chinois + JSON-LD FAQPage valide par langue, drapeaux = liens corrects.
   - Mobile 375px : hamburger (label/checkbox) ouvre le menu, padding latéral, pas de
     recouvrement (44px), pas de défilement horizontal.
   - Grille : comparer les métriques avec `_dev/metrics-before.json` (capture AVANT la
     dé-skellisation, via `_dev/capture_reference.js`). Tolérance quelques px. Attention :
     `row-gap` ajouté dans layout.css = espacement vertical nouveau quand les colonnes
     s'empilent, à valider visuellement (l'ancien skel n'en avait pas, les blocs se touchaient).
   - Photos : ~101 images, scroll-snap fonctionne.
   - Zéro requête JS, zéro 404 local, zéro erreur console.
2. **Vérifs déjà faites** (spot-checks à l'assemblage, pas encore en navigateur) :
   de/chambres contient "Zimmer" et les prix allemands, zh/faq contient 常见问题,
   photos.html contient 101 images, hreflang présents.
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
  main au commit 6fa0468).
- `preview_test.js` : suite navigateur (À RÉÉCRIRE, voir ci-dessus).

Pièges rencontrés (ne pas retomber dedans) :
- Ruby : `$1`/`$2` sont écrasés par tout nouveau match (scan...) : capturer dans des locales
  d'abord. Ce bug a mordu deux fois dans cette session.
- Le tag Liquid `{% include x.html param="..." %}` est du Jekyll, pas du Liquid standard :
  l'assembleur enregistre un tag custom qui l'émule (paramètres avec espaces gérés par regex).
- Les valeurs de gouttières de l'ancienne grille skel : 50px base, 40 ≤1680, 30 ≤1280,
  20 ≤736 ; `row 200%` double, `row 50%` moitié. Vérifié empiriquement dans metrics-before.

## Décisions prises (avec Nicolas)

- Pas de JS sauf si nécessaire pour la galerie (finalement : zéro JS, scroll-snap suffit).
- Chinois : URLs et code langue `zh` (standard), l'ancien code interne était `cn`.
- `merci` et `legal` restent en français uniquement.
- Jekyll + Netlify + édition GitHub conservés, identité visuelle inchangée.
- L'apparence doit rester identique (les métriques de grille font foi), à l'exception
  des corrections assumées : prix à jour, hamburger visible, padding mobile.
