# Mettre à jour la page FAQ

La page [la-villa-paris.com/faq](https://la-villa-paris.com/faq) est alimentée par 5 fichiers, un par langue, dans le dossier [`_faq/`](_faq/) :

| Fichier | Langue |
|---|---|
| `_faq/fr.md` | Français |
| `_faq/en.md` | Anglais |
| `_faq/de.md` | Allemand |
| `_faq/es.md` | Espagnol |
| `_faq/cn.md` | Chinois |

Le visiteur voit la version correspondant à la langue de son navigateur, et peut changer avec les drapeaux en bas de page, comme sur le reste du site.

## Ajouter ou modifier une question

1. Sur GitHub, ouvrir le dossier `_faq/` puis cliquer sur le fichier de la langue (par exemple `fr.md`).
2. Cliquer sur le crayon ✏️ en haut à droite ("Edit this file").
3. Ajouter la question et sa réponse à la fin du fichier, en respectant ce format :

   ```
   ### Ma nouvelle question ?

   La réponse, en une ou plusieurs phrases.
   ```

   Important :
   - La question commence par `### ` (trois dièses puis un espace), sur une seule ligne.
   - La réponse vient en dessous, séparée par une ligne vide.
   - Laisser une ligne vide entre chaque bloc question/réponse.
4. Cliquer sur "Commit changes" (bouton vert), puis encore "Commit changes" dans la fenêtre qui s'ouvre.
5. Répéter la même chose dans les 4 autres fichiers de langue avec la traduction.

Le site se met à jour automatiquement 1 à 2 minutes après le commit (déploiement Netlify).

## À ne pas toucher

- Les 3 premières lignes du fichier (`---`, `lang: fr`, `---`) : elles indiquent la langue au site.
- La première ligne `## Questions fréquentes` : c'est le titre de la page (deux dièses, pas trois).

## Mise en forme dans les réponses

- Gras : `**texte important**`
- Italique : `*texte*`
- Lien : `[texte du lien](https://exemple.com)`

## Idées de questions à ajouter

Reprendre les réponses déjà publiées sur Booking, par exemple :

- Horaires d'arrivée et de départ (check-in / check-out)
- Les animaux sont-ils acceptés ?
- Enfants, lits d'appoint
- Taxe de séjour
- Peut-on laisser les bagages avant/après le séjour ?
- Conditions d'annulation
- Y a-t-il un ascenseur / la maison est-elle accessible ?

## Bonus référencement

Les questions/réponses de la version française sont automatiquement transmises à Google au format "FAQPage" (schema.org) : elles peuvent apparaître directement dans les résultats de recherche.
