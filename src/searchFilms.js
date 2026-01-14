import { SparqlClient } from "./SparqlClient.js";

const wikidataUrl = "https://query.wikidata.org/sparql";
const client = new SparqlClient(wikidataUrl);

export async function searchMoviesOnWikidata(term) {
const query = `
    SELECT DISTINCT ?item ?itemLabel ?date ?image 
                    ?director ?directorLabel 
                    ?genre ?genreLabel 
                    ?screenwriter 
                    ?country 
                    ?language WHERE {

      # 1. MOTEUR DE RECHERCHE (Pertinence)
      SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:api "EntitySearch" .
          bd:serviceParam wikibase:endpoint "www.wikidata.org" .
          bd:serviceParam mwapi:search "${term}" . 
          bd:serviceParam mwapi:language "fr" .
          ?item wikibase:apiOutputItem mwapi:item .
      }

      # 2. FILTRE : On ne garde que les films (Q11424)
      ?item wdt:P31 wd:Q11424 .
      
      # 3. RÉCUPÉRATION DES DONNÉES (OPTIONAL)
      OPTIONAL { ?item wdt:P577 ?date . }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P57 ?director . }
      OPTIONAL { ?item wdt:P136 ?genre . }
      OPTIONAL { ?item wdt:P58 ?screenwriter . }
      OPTIONAL { ?item wdt:P495 ?country . }
      OPTIONAL { ?item wdt:P364 ?language . }

      # 4. LIBELLÉS AUTOMATIQUES
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `;

  const rawData = await client.query(query);
  const bindings = rawData?.results?.bindings;

  if (!bindings || bindings.length === 0) {
    return [];
  }
  
  // 2. TRAITEMENT DES DONNÉES
  const moviesMap = processData(bindings);

  // 3. FORMATAGE FINAL SELON TA DEMANDE
  const moviesLibrary = Array.from(moviesMap.values()).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.year,
    image: m.image,
    
    // Réalisateur
    directorId: m.directorId,
    directorName: m.directorName,
    
    // NOUVEAUX CHAMPS
    // On prend le premier trouvé (Wikidata peut en renvoyer plusieurs)
    screenwriterId: m.screenwriterIds.values().next().value || null,
    countryId: m.countryIds.values().next().value || null,
    languageId: m.languageIds.values().next().value || null,

    // Genres (Tableau d'IDs)
    genresIds: Array.from(m.genresIds),
    genresLabels: Array.from(m.genresLabels),
  }));
  console.log(moviesLibrary);
  
  return moviesLibrary;
}

function processData(bindings) {
  const moviesMap = new Map();

  bindings.forEach((bind) => {
    const qid = bind.item.value.split("/").pop();

    if (!moviesMap.has(qid)) {
      moviesMap.set(qid, {
        id: qid,
        title: bind.itemLabel.value,
        image: bind.image ? bind.image.value : null,
        year: bind.date ? parseInt(bind.date.value.substring(0, 4)) : "N/C",
        
        directorId: bind.director ? bind.director.value.split("/").pop() : null,
        directorName: bind.directorLabel ? bind.directorLabel.value : "Inconnu",
        
        // Initialisation des Sets pour gérer les doublons de lignes
        genresIds: new Set(),
        genresLabels: new Set(),
        screenwriterIds: new Set(),
        countryIds: new Set(),
        languageIds: new Set()
      });
    }

    const film = moviesMap.get(qid);

    // --- Remplissage des données ---

    // Genre
    if (bind.genre) {
      film.genresIds.add(bind.genre.value.split("/").pop());
      if (bind.genreLabel) film.genresLabels.add(bind.genreLabel.value);
    }

    // Scénariste
    if (bind.screenwriter) {
      film.screenwriterIds.add(bind.screenwriter.value.split("/").pop());
    }

    // Pays
    if (bind.country) {
      film.countryIds.add(bind.country.value.split("/").pop());
    }

    // Langue
    if (bind.language) {
      film.languageIds.add(bind.language.value.split("/").pop());
    }
  });

  return moviesMap;
}