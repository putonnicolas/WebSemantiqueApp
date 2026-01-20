import { SparqlClient } from "./SparqlClient.js";

const WEIGHTS = {
  GENRE: 10,
  DIRECTOR: 15,
  SCREENWRITER: 10,
  CAST: 15,
  COUNTRY: 5,
  LANGUAGE: 5,
};

let finalResults = [];

const wikidataUrl = "https://query.wikidata.org/sparql";
const client = new SparqlClient(wikidataUrl);

let savedMovies = JSON.parse(sessionStorage.getItem("moviesUsed")) || [];

async function getOptimizedRecommendations() {
  console.log("--- DÉBUT getOptimizedRecommendations ---");

  if (savedMovies.length === 0) {
    console.log("Aucun film sauvegardé.");
    const container = document.getElementById("results");
    if (container) {
      container.innerHTML =
        "<p>Aucun film sélectionné. Retournez à la page d'accueil pour ajouter des films à votre liste.</p>";
    }
    return;
  }

  const SELECTED_MOVIES = savedMovies;
  const container = document.getElementById("results");
  const loadingMsg = document.getElementById("loadingMsg");

  console.log("Container DOM trouvé:", !!container);

  if (container) container.innerHTML = "";
  if (loadingMsg) {
    loadingMsg.style.display = "block";
    loadingMsg.innerHTML =
      "Recherche de films que vous pourriez aimer en cours...";
  }

  console.log("Films source:", SELECTED_MOVIES);

  savedMovies.map((m) => {
    console.log(m);
  });
  const criteria = {
    directors: new Set(
      savedMovies
        .map((m) => m.directorId)
        .filter((id) => id && id !== "undefined"),
    ),
    genres: new Set(
      savedMovies
        .flatMap((m) => m.genresIds || [])
        .filter((id) => id && id !== "undefined"),
    ),
    screenwriters: new Set(
      savedMovies
        .map((m) => m.screenwriterId)
        .filter((id) => id && id !== "undefined"),
    ),
    countries: new Set(
      savedMovies
        .map((m) => m.countryId)
        .filter((id) => id && id !== "undefined"),
    ),
    languages: new Set(
      savedMovies
        .map((m) => m.languageId)
        .filter((id) => id && id !== "undefined"),
    ),
    actors: new Set(
      savedMovies
        .flatMap((m) => m.cast || [])
        .map((actor) => actor.id)
        .filter((id) => id && id !== "undefined"),
    ),
    excluded: new Set(savedMovies.map((m) => m.id).filter((id) => id)),
  };
  console.log("Critères nettoyés:", criteria);

  const years = savedMovies.map((m) => m.year).filter((y) => !isNaN(y));
  const minYear = years.length ? Math.min(...years) - 15 : 1990;
  const maxYear = years.length ? Math.max(...years) + 5 : 2030;

  const genList = [...criteria.genres].map((g) => `wd:${g}`).join(" ");
  const dirList = [...criteria.directors].map((d) => `wd:${d}`).join(" ");
  const actList = [...criteria.actors].map((a) => `wd:${a}`).join(" ");
  const excList = [...criteria.excluded].map((e) => `wd:${e}`).join(" ");

  const query = `
SELECT DISTINCT ?movie ?movieLabel ?movieDescription ?year ?image 
                ?director ?directorLabel ?dirId 
                ?genre ?genreLabel ?genId 
                ?screenwriter ?scrId 
                ?country ?cntId 
                ?language ?lngId 
                ?actor ?actorLabel ?actId 
WHERE {
  {
    # --- SOUS-REQUÊTE : On sélectionne d'abord les 50 films uniques ---
    SELECT DISTINCT ?movie ?year WHERE {
      {
        ${genList ? `{ ?movie wdt:P136 ?genSearch. VALUES ?genSearch { ${genList} } }` : ""}
        ${genList && dirList ? "UNION" : ""}
        ${dirList ? `{ ?movie wdt:P57 ?dirSearch. VALUES ?dirSearch { ${dirList} } }` : ""}
      }
      
      ?movie wdt:P31 wd:Q11424;
             wdt:P577 ?date.
      BIND(YEAR(?date) AS ?year)
      FILTER(?year >= ${minYear} && ?year <= ${maxYear})

      # Exclusion des films déjà enregistrés
      FILTER NOT EXISTS { VALUES ?err { ${excList || "wd:Q0"} } FILTER(?movie = ?err) }
    }
    LIMIT 50
  }
  
  # --- RÉCUPÉRATION DES DÉTAILS (Uniquement pour les films sélectionnés au-dessus) ---
  
  OPTIONAL { ?movie wdt:P18 ?image. }
  
  # Réalisateur
  OPTIONAL { 
    ?movie wdt:P57 ?director. 
    BIND(STRAFTER(STR(?director), "entity/") AS ?dirId) 
  }
  
  # Genre
  OPTIONAL { 
    ?movie wdt:P136 ?genre. 
    BIND(STRAFTER(STR(?genre), "entity/") AS ?genId) 
  }
  
  # Scénariste
  OPTIONAL { 
    ?movie wdt:P58 ?screenwriter. 
    BIND(STRAFTER(STR(?screenwriter), "entity/") AS ?scrId) 
  }
  
  # Pays
  OPTIONAL { 
    ?movie wdt:P495 ?country. 
    BIND(STRAFTER(STR(?country), "entity/") AS ?cntId) 
  }
  
  # Langue
  OPTIONAL { 
    ?movie wdt:P364 ?language. 
    BIND(STRAFTER(STR(?language), "entity/") AS ?lngId) 
  }
  
  # Acteurs (On filtre par ceux du profil pour accélérer, mais sans bloquer)
  OPTIONAL { 
    ?movie wdt:P161 ?actor. 
    ${actList ? `VALUES ?actor { ${actList} }` : ""} 
    BIND(STRAFTER(STR(?actor), "entity/") AS ?actId) 
  }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
ORDER BY DESC(?year)
LIMIT 500`;

  console.log("Requête générée:\n", query);

  try {
    const rawData = await client.query(query);
    console.log("Données brutes reçues:", rawData);

    const bindings = rawData?.results?.bindings || rawData;

    if (!bindings || bindings.length === 0) {
      console.log("Aucun résultat trouvé.");
      if (loadingMsg) loadingMsg.innerHTML = "Pas de résultats correspondants.";
      return [];
    }

    const moviesMap = processData(bindings);

    finalResults = Array.from(moviesMap.values()).map((movie) => {
      let score = 0;
      let reasons = new Set();

      movie.genresIds.forEach((g) => {
        if (criteria.genres.has(g)) {
          score += WEIGHTS.GENRE;
          reasons.add("genre");
        }
      });
      console.log(movie);

      if (criteria.directors.has(movie.directorId)) {
        score += WEIGHTS.DIRECTOR;
        reasons.add("réalisateur");
      }

      movie.screenwriterIds.forEach((s) => {
        if (criteria.screenwriters.has(s)) {
          score += WEIGHTS.SCREENWRITER;
          reasons.add("scénariste");
        }
      });

      movie.countryIds.forEach((c) => {
        if (criteria.countries.has(c)) {
          score += WEIGHTS.COUNTRY;
          reasons.add("pays");
        }
      });

      movie.languageIds.forEach((l) => {
        if (criteria.languages.has(l)) {
          score += WEIGHTS.LANGUAGE;
          reasons.add("langue");
        }
      });

      movie.actorsIds.forEach((a) => {
        if (criteria.actors.has(a)) {
          score += WEIGHTS.CAST;
          reasons.add("casting");
        }
      });
      console.log("Raisons :");

      console.log({ score, reasons: Array.from(reasons) });

      return {
        ...movie,
        recommendation: { score, reasons: Array.from(reasons) },
      };
    });

    finalResults.sort(
      (a, b) =>
        b.recommendation.score - a.recommendation.score || b.year - a.year,
    );

    console.log("Résultats finaux:", finalResults);

    if (loadingMsg) loadingMsg.style.display = "none";
    afficherFilms(finalResults);
  } catch (error) {
    console.error("ERREUR FATALE:", error);
    if (loadingMsg)
      loadingMsg.innerHTML = "Erreur technique lors de la recherche.";
  }
}

function processData(bindings) {
  const moviesMap = new Map();

  bindings.forEach((bind) => {
    const qid = bind.movie.value.split("/").pop();

    if (!moviesMap.has(qid)) {
      moviesMap.set(qid, {
        id: qid,
        description: bind.movieDescription ? bind.movieDescription.value : null,
        title: bind.movieLabel ? bind.movieLabel.value : "Titre Inconnu",
        year: bind.year ? parseInt(bind.year.value) : "N/C",
        image: bind.image ? bind.image.value : null,

        directorId: bind.dirId ? bind.dirId.value : null,
        directorName: bind.directorLabel ? bind.directorLabel.value : "Inconnu",

        genresIds: new Set(),
        genresLabels: new Set(),

        screenwriterIds: new Set(),
        countryIds: new Set(),
        languageIds: new Set(),
        actorsIds: new Set(),
      });
    }

    const film = moviesMap.get(qid);

    if (bind.genId) {
      film.genresIds.add(bind.genId.value);
      if (bind.genreLabel) film.genresLabels.add(bind.genreLabel.value);
    }
    if (bind.scrId) film.screenwriterIds.add(bind.scrId.value);
    if (bind.cntId) film.countryIds.add(bind.cntId.value);
    if (bind.lngId) film.languageIds.add(bind.lngId.value);
    if (bind.actId) film.actorsIds.add(bind.actId.value);
  });

  return moviesMap;
}

async function afficherFilms(finalResults) {
  const resultsDiv = document.querySelector("#results");

  let html = "";
  finalResults.forEach((film, index) => {
    html += `
        <div class="film-card">
          ${film.image ? `<img src="${film.image}" alt="${film.title}"/>` : ""}
          
          <div class="film-info-overlay">
            <div class="info-text" onclick="ouvrirDetails(${index})">
              <h3>${film.title}</h3>
              <p>${film.directorName} - ${film.year}</p>
              <small>${Array.from(film.genresLabels).at(0)}</small> 
              <br>
              <small style="color:#aaa">Match: ${film.recommendation.reasons.join(", ")}</small>
            </div>
            <div class="score-badge">${film.recommendation.score}</div>
          </div>
        </div>
      `;
  });

  resultsDiv.innerHTML = html;
}

function updateSavedListUI() {
  const placeholders = document.querySelectorAll(".movie-placeholder");

  placeholders.forEach((p) => {
    p.classList.remove("filled");
    p.innerHTML = "";
  });

  savedMovies.forEach((film, index) => {
    if (index < placeholders.length) {
      const p = placeholders[index];
      p.classList.add("filled");
      p.innerHTML = `
        <div class="mini-card">
          ${film.image ? `<img src="${film.image}" alt="${film.title}"/>` : ""}
          <div class="mini-card-info">
            <span class="mini-title">${film.title}</span>
            <button class="remove-btn" onclick="supprimerFilm(${index})">×</button>
          </div>
        </div>
      `;
    }
  });
}

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI();
  // Petit délai pour assurer que tout est chargé
  setTimeout(getOptimizedRecommendations, 100);
});

document
  .getElementById("btnSearch")
  ?.addEventListener("click", getOptimizedRecommendations);

window.ouvrirDetails = function (index) {
  let film = finalResults[index];
  film.isRecommended = true;

  // On transforme chaque Set en Array pour que JSON.stringify fonctionne
  let filmToSave = {
    ...film,
    actorsIds: Array.from(film.actorsIds || []),
    countryIds: Array.from(film.countryIds || []),
    genresIds: Array.from(film.genresIds || []),
    genresLabels: Array.from(film.genresLabels || []),
    languageIds: Array.from(film.languageIds || []),
    screenwriterIds: Array.from(film.screenwriterIds || [])
  };
  
  sessionStorage.setItem("moviesClick", JSON.stringify(filmToSave));

  window.location.href = "infos_film.html";
};
