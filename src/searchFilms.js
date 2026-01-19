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
                    ?language 
                    ?actor ?actorLabel WHERE {    

      # MOTEUR DE RECHERCHE
      SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:api "EntitySearch" .
          bd:serviceParam wikibase:endpoint "www.wikidata.org" .
          bd:serviceParam mwapi:search "${term}" . 
          bd:serviceParam mwapi:language "fr" .
          ?item wikibase:apiOutputItem mwapi:item .
      }

      ?item wdt:P31 wd:Q11424 .
      
      OPTIONAL { ?item wdt:P577 ?date . }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P57 ?director . }
      OPTIONAL { ?item wdt:P136 ?genre . }
      OPTIONAL { ?item wdt:P58 ?screenwriter . }
      OPTIONAL { ?item wdt:P495 ?country . }
      OPTIONAL { ?item wdt:P364 ?language . }

      # ACTEURS (P161)
      OPTIONAL { ?item wdt:P161 ?actor . }

      # Le service remplit automatiquement ?actorLabel si ?actor existe
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `;

  const rawData = await client.query(query);
  const bindings = rawData?.results?.bindings;

  if (!bindings || bindings.length === 0) {
    return [];
  }
  
  const moviesMap = processData(bindings);

  const moviesLibrary = Array.from(moviesMap.values()).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.year,
    image: m.image,
    
    directorId: m.directorId,
    director: m.directorName,
    
    screenwriterIds: Array.from(m.screenwriterIds),
    countryIds: Array.from(m.countryIds),
    languageIds: Array.from(m.languageIds),

    genres: Array.from(m.genresIds),
    genre: Array.from(m.genresLabels).join(", "),

    cast: Array.from(m.cast.keys())
  }));
  
  return moviesLibrary;
}

function processData(bindings) {
  const moviesMap = new Map();

  bindings.forEach((bind) => {
    const qid = bind.item.value.split("/").pop();

    if (!moviesMap.has(qid)) {
      moviesMap.set(qid, {
        id: qid,
        title: bind.itemLabel ? bind.itemLabel.value : "Titre Inconnu",
        image: bind.image ? bind.image.value : null,
        year: bind.date ? parseInt(bind.date.value.substring(0, 4)) : "N/C",
        
        directorId: bind.director ? bind.director.value.split("/").pop() : null,
        directorName: bind.directorLabel ? bind.directorLabel.value : "Inconnu",
        
        genresIds: new Set(),
        genresLabels: new Set(),
        screenwriterIds: new Set(),
        countryIds: new Set(),
        languageIds: new Set(),
        
        cast: new Map() 
      });
    }

    const film = moviesMap.get(qid);

    if (bind.genre) {
      film.genresIds.add(bind.genre.value.split("/").pop());
      if (bind.genreLabel) film.genresLabels.add(bind.genreLabel.value);
    }
    if (bind.screenwriter) film.screenwriterIds.add(bind.screenwriter.value.split("/").pop());
    if (bind.country) film.countryIds.add(bind.country.value.split("/").pop());
    if (bind.language) film.languageIds.add(bind.language.value.split("/").pop());

    if (bind.actor) {
        const actorId = bind.actor.value.split("/").pop();
        const actorName = bind.actorLabel ? bind.actorLabel.value : "Nom Inconnu";
        
        film.cast.set(actorId, actorName);
    }
  });

  return moviesMap;
}