# Underdeck JPL proxy (Cloudflare Worker)

Les API NASA/JPL (Horizons, SBDB) n'envoient pas d'en-têtes CORS : un
navigateur ne peut pas les appeler directement. Ce worker — déployé sur
**votre** compte Cloudflare (offre gratuite : 100 000 requêtes/jour) — relaie
les trois endpoints utilisés par Underdeck et ajoute les en-têtes CORS.

| Route worker    | API JPL                                        |
| --------------- | ---------------------------------------------- |
| `/horizons?…`   | `https://ssd.jpl.nasa.gov/api/horizons.api?…`  |
| `/sbdb?…`       | `https://ssd-api.jpl.nasa.gov/sbdb.api?…`      |
| `/sbdb_query?…` | `https://ssd-api.jpl.nasa.gov/sbdb_query.api?…`|

## Déploiement (~10 minutes, une seule fois)

1. Créez un compte gratuit sur <https://dash.cloudflare.com/sign-up> si vous
   n'en avez pas.
2. Dans ce dossier (`worker/`), lancez :

   ```sh
   npx wrangler login    # ouvre le navigateur pour autoriser wrangler
   npx wrangler deploy
   ```

3. Wrangler affiche l'URL du worker, par exemple :

   ```
   https://underdeck-jpl-proxy.<votre-sous-domaine>.workers.dev
   ```

4. Renseignez cette URL dans la webapp :
   - **Pour le build** : variable `VITE_JPL_PROXY_URL` (fichier
     `webapp/.env.production` ou secret d'Actions `JPL_PROXY_URL`).
   - **Sans rebuild** : écran *Settings* de la webapp → champ « JPL proxy URL »
     (stocké dans le navigateur, prioritaire sur la valeur de build).

## Verrouillage (recommandé une fois le site en ligne)

Dans `wrangler.toml`, remplacez `ALLOWED_ORIGINS = "*"` par l'origine réelle
du site, puis redéployez :

```toml
ALLOWED_ORIGINS = "https://<votre-compte>.github.io"
```

```sh
npx wrangler deploy
```

## Vérification

```sh
curl "https://underdeck-jpl-proxy.<sous-domaine>.workers.dev/sbdb?sstr=433"
# → JSON SBDB de (433) Eros, avec l'en-tête Access-Control-Allow-Origin
```

> **Note** : `npx wrangler dev` (simulateur local) échoue à joindre les
> serveurs JPL (« internal error » — incompatibilité connue workerd ↔ ALB
> AWS). C'est un artefact du simulateur uniquement : vérifiez avec la
> commande curl ci-dessus **après** le vrai déploiement.
