import { SparqlClient } from "./SparqlClient.js";
import { getPosterWithFallback } from "./tmdb.js";

const wikidataUrl = "https://query.wikidata.org/sparql";
const client = new SparqlClient(wikidataUrl);

/**
 * Fast search that only fetches minimal data for display
 */
export async function searchMoviesOnWikidata(term) {
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?date ?image 
                    ?director ?directorLabel 
                    ?genre ?genreLabel WHERE {    

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

      # Le service remplit automatiquement ?itemDescription grâce à la langue
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `;

  const rawData = await client.query(query);
  const bindings = rawData?.results?.bindings;

  if (!bindings || bindings.length === 0) {
    return [];
  }
  
  const moviesMap = processMinimalData(bindings);

  const moviesLibrary = Array.from(moviesMap.values()).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    year: m.year,
    image: m.image,
    directorId: m.directorId,
    director: m.directorName,
    genresLabels: Array.from(m.genresLabels)
  }));
  
  // Fetch TMDB posters for all movies in parallel
  const moviesWithPosters = await Promise.all(
    moviesLibrary.map(async (movie) => {
      const posterUrl = await getPosterWithFallback(movie.title, movie.year, movie.image);
      return {
        ...movie,
        image: posterUrl
      };
    })
  );

  return moviesWithPosters;
}

/**
 * Fetch complete movie details (called when adding to saved movies)
 */
export async function getMovieFullDetails(movieId) {
  console.log("Fetching full details for movie ID:", movieId);
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?date ?image 
                    ?director ?directorLabel 
                    ?genre ?genreLabel 
                    ?screenwriter 
                    ?country 
                    ?language 
                    ?actor ?actorLabel 
                    ?mainSubject WHERE {    

      BIND(wd:${movieId} as ?item)
      
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
      
      # SUJETS PRINCIPAUX (P921)
      OPTIONAL { ?item wdt:P921 ?mainSubject . }

      # Le service remplit automatiquement ?itemDescription grâce à la langue
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
  `;

  const rawData = await client.query(query);
  const bindings = rawData?.results?.bindings;

  if (!bindings || bindings.length === 0) {
    return null;
  }
  
  const moviesMap = processData(bindings);
  const movieData = moviesMap.get(movieId);
  
  if (!movieData) {
    return null;
  }

  return {
    id: movieData.id,
    title: movieData.title,
    description: movieData.description,
    year: movieData.year,
    image: movieData.image,
    
    directorId: movieData.directorId,
    director: movieData.directorName,
    
    screenwriterIds: Array.from(movieData.screenwriterIds),
    countryIds: Array.from(movieData.countryIds),
    languageIds: Array.from(movieData.languageIds),
    mainSubjectIds: Array.from(movieData.mainSubjectIds),

    genres: Array.from(movieData.genresIds),
    genresLabels: Array.from(movieData.genresLabels),

    cast: Array.from(movieData.cast.keys())
  };
}

/**
 * Process minimal data for fast search results
 */
function processMinimalData(bindings) {
  const moviesMap = new Map();

  bindings.forEach((bind) => {
    const qid = bind.item.value.split("/").pop();

    if (!moviesMap.has(qid)) {
      moviesMap.set(qid, {
        id: qid,
        title: bind.itemLabel ? bind.itemLabel.value : "Titre Inconnu",
        description: bind.itemDescription ? bind.itemDescription.value : "",
        image: bind.image ? bind.image.value : null,
        year: bind.date ? parseInt(bind.date.value.substring(0, 4)) : "N/C",
        
        directorId: bind.director ? bind.director.value.split("/").pop() : null,
        directorName: bind.directorLabel ? bind.directorLabel.value : "Inconnu",
        
        genresLabels: new Set()
      });
    }

    const film = moviesMap.get(qid);

    if (bind.genre && bind.genreLabel) {
      film.genresLabels.add(bind.genreLabel.value);
    }
  });

  return moviesMap;
}

/**
 * Process full data for complete movie details
 */
function processData(bindings) {
  const moviesMap = new Map();

  bindings.forEach((bind) => {
    const qid = bind.item.value.split("/").pop();

    if (!moviesMap.has(qid)) {
      moviesMap.set(qid, {
        id: qid,
        title: bind.itemLabel ? bind.itemLabel.value : "Titre Inconnu",
        description: bind.itemDescription ? bind.itemDescription.value : "",
        image: bind.image ? bind.image.value : null,
        year: bind.date ? parseInt(bind.date.value.substring(0, 4)) : "N/C",
        
        directorId: bind.director ? bind.director.value.split("/").pop() : null,
        directorName: bind.directorLabel ? bind.directorLabel.value : "Inconnu",
        
        genresIds: new Set(),
        genresLabels: new Set(),
        screenwriterIds: new Set(),
        countryIds: new Set(),
        languageIds: new Set(),
        mainSubjectIds: new Set(),
        
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
    if (bind.mainSubject) film.mainSubjectIds.add(bind.mainSubject.value.split("/").pop());

    if (bind.actor) {
        const actorId = bind.actor.value.split("/").pop();
        const actorName = bind.actorLabel ? bind.actorLabel.value : "Nom Inconnu";
        
        film.cast.set(actorId, actorName);
    }
  });

  return moviesMap;
}