import { SparqlClient } from "./SparqlClient.js";

const WEIGHTS = {
  GENRE: 10,
  DIRECTOR: 15,
  SCREENWRITER: 10,
  CAST: 15,
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
        .flatMap((m) => m.genres || [])
        .filter((id) => id && id !== "undefined"),
    ),
    screenwriters: new Set(
      savedMovies
        .flatMap((m) => m.screenwriterIds || [])
        .filter((id) => id && id !== "undefined"),
    ),
    countries: new Set(
      savedMovies
        .flatMap((m) => m.countryIds || [])
        .filter((id) => id && id !== "undefined"),
    ),
    languages: new Set(
      savedMovies
        .flatMap((m) => m.languageIds || [])
        .filter((id) => id && id !== "undefined"),
    ),
    actors: new Set(
      savedMovies
        .flatMap((m) => m.cast || [])
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
  const scrList = [...criteria.screenwriters].map((s) => `wd:${s}`).join(" ");
  const excList = [...criteria.excluded].map((e) => `wd:${e}`).join(" ");

  console.log("📋 Criteria sizes:", {
    directors: criteria.directors.size,
    genres: criteria.genres.size,
    screenwriters: criteria.screenwriters.size,
    actors: criteria.actors.size,
  });
  
  console.log("📋 Lists prepared:", {
    dirList: dirList ? `${dirList.substring(0, 50)}...` : "EMPTY",
    genList: genList ? `${genList.substring(0, 50)}...` : "EMPTY",
    actList: actList ? `${actList.substring(0, 50)}...` : "EMPTY",
    scrList: scrList ? `${scrList.substring(0, 50)}...` : "EMPTY",
  });

  console.log("🎬 Multi-tier query approach: fetching candidates by tier...");

  // Helper function to build a candidate query
  const buildCandidateQuery = (matchClause, limit) => `
    SELECT DISTINCT ?movie WHERE {
      ${matchClause}
      ?movie wdt:P31 wd:Q11424;
             wdt:P577 ?date.
      BIND(YEAR(?date) AS ?year)
      FILTER(?year >= ${minYear} && ?year <= ${maxYear})
      FILTER NOT EXISTS { VALUES ?err { ${excList || "wd:Q0"} } FILTER(?movie = ?err) }
    }
    LIMIT ${limit}
  `;

  // Collect movie IDs from each tier
  const candidateMovieIds = new Set();

  try {
    // Tier 1: Directors (150 movies max) - strongest signal
    if (dirList) {
      console.log("  ⭐ Tier 1: Fetching from directors...");
      const dirQuery = buildCandidateQuery(
        `?movie wdt:P57 ?dir. VALUES ?dir { ${dirList} }`,
        150
      );
      const dirResults = await client.query(dirQuery);
      const dirBindings = dirResults?.results?.bindings || dirResults || [];
      dirBindings.forEach(b => candidateMovieIds.add(b.movie.value.split("/").pop()));
      console.log(`    ✓ Found ${dirBindings.length} from directors`);
    } else {
      console.log("  ⭕ Tier 1 SKIPPED: No directors in criteria");
    }

    // Tier 2: Screenwriters (100 movies max) - strong thematic signal
    if (scrList) {
      console.log("  📝 Tier 2: Fetching from screenwriters...");
      const scrQuery = buildCandidateQuery(
        `?movie wdt:P58 ?scr. VALUES ?scr { ${scrList} }`,
        100
      );
      const scrResults = await client.query(scrQuery);
      const scrBindings = scrResults?.results?.bindings || scrResults || [];
      scrBindings.forEach(b => candidateMovieIds.add(b.movie.value.split("/").pop()));
      console.log(`    ✓ Found ${scrBindings.length} from screenwriters`);
    } else {
      console.log("  ⭕ Tier 2 SKIPPED: No screenwriters in criteria");
    }

    // Tier 3: Actors (80 movies max) - decent signal
    if (actList) {
      console.log("  🎭 Tier 3: Fetching from actors...");
      const actQuery = buildCandidateQuery(
        `?movie wdt:P161 ?act. VALUES ?act { ${actList} }`,
        80
      );
      const actResults = await client.query(actQuery);
      const actBindings = actResults?.results?.bindings || actResults || [];
      actBindings.forEach(b => candidateMovieIds.add(b.movie.value.split("/").pop()));
      console.log(`    ✓ Found ${actBindings.length} from actors`);
    } else {
      console.log("  ⭕ Tier 3 SKIPPED: No actors in criteria");
    }

    // Tier 4: Genres with 2+ matches (50 movies max) - weak signal, limited volume
    if (genList && criteria.genres.size >= 2) {
      console.log("  🎨 Tier 4: Fetching multi-genre matches...");
      const genQuery = `
        SELECT DISTINCT ?movie (COUNT(DISTINCT ?genre) as ?genreCount) WHERE {
          ?movie wdt:P136 ?genre. VALUES ?genre { ${genList} }
          ?movie wdt:P31 wd:Q11424;
                 wdt:P577 ?date.
          BIND(YEAR(?date) AS ?year)
          FILTER(?year >= ${minYear} && ?year <= ${maxYear})
          FILTER NOT EXISTS { VALUES ?err { ${excList || "wd:Q0"} } FILTER(?movie = ?err) }
        }
        GROUP BY ?movie
        HAVING (COUNT(DISTINCT ?genre) >= 2)
        LIMIT 50
      `;
      const genResults = await client.query(genQuery);
      const genBindings = genResults?.results?.bindings || genResults || [];
      genBindings.forEach(b => candidateMovieIds.add(b.movie.value.split("/").pop()));
      console.log(`    ✓ Found ${genBindings.length} multi-genre matches`);
    } else {
      if (!genList) {
        console.log("  ⭕ Tier 4 SKIPPED: No genres in criteria");
      } else if (criteria.genres.size < 2) {
        console.log(`  ⭕ Tier 4 SKIPPED: Only ${criteria.genres.size} genre(s), need at least 2`);
      }
    }

    console.log(`\n🎯 Total unique candidates: ${candidateMovieIds.size}`);

    if (candidateMovieIds.size === 0) {
      console.log("Aucun résultat trouvé.");
      if (loadingMsg) loadingMsg.innerHTML = "Pas de résultats correspondants.";
      return [];
    }

    // Fetch details in batches to avoid timeouts
    const BATCH_SIZE = 10;
    const allMovieIds = Array.from(candidateMovieIds);
    const allBindings = [];

    console.log(`📦 Fetching details for ${allMovieIds.length} candidates in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < allMovieIds.length; i += BATCH_SIZE) {
      const batch = allMovieIds.slice(i, i + BATCH_SIZE);
      const movieIdList = batch.map(id => `wd:${id}`).join(" ");
      
      const detailsQuery = `
SELECT DISTINCT ?movie ?movieLabel ?movieDescription ?year ?image 
                ?director ?directorLabel ?dirId 
                ?genre ?genreLabel ?genId 
                ?screenwriter ?scrId 
                ?actor ?actorLabel ?actId 
WHERE {
  VALUES ?movie { ${movieIdList} }
  
  ?movie wdt:P31 wd:Q11424;
         wdt:P577 ?date.
  BIND(YEAR(?date) AS ?year)
  
  OPTIONAL { ?movie wdt:P18 ?image. }
  
  OPTIONAL { 
    ?movie wdt:P57 ?director. 
    BIND(STRAFTER(STR(?director), "entity/") AS ?dirId) 
  }
  
  OPTIONAL { 
    ?movie wdt:P136 ?genre. 
    BIND(STRAFTER(STR(?genre), "entity/") AS ?genId) 
  }
  
  OPTIONAL { 
    ?movie wdt:P58 ?screenwriter. 
    BIND(STRAFTER(STR(?screenwriter), "entity/") AS ?scrId) 
  }
  
  OPTIONAL { 
    ?movie wdt:P495 ?country. 
    BIND(STRAFTER(STR(?country), "entity/") AS ?cntId) 
  }
  
  OPTIONAL { 
    ?movie wdt:P364 ?language. 
    BIND(STRAFTER(STR(?language), "entity/") AS ?lngId) 
  }
  
  OPTIONAL { 
    ?movie wdt:P161 ?actor. 
    BIND(STRAFTER(STR(?actor), "entity/") AS ?actId) 
  }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
ORDER BY DESC(?year)
`;

      try {
        const batchData = await client.query(detailsQuery);
        const batchBindings = batchData?.results?.bindings || batchData || [];
        allBindings.push(...batchBindings);
        console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allMovieIds.length / BATCH_SIZE)}: ${batchBindings.length} results`);
      } catch (err) {
        console.warn(`  ⚠️  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, skipping:`, err.message);
      }
    }

    console.log(`📊 Total results fetched: ${allBindings.length}`);

    if (allBindings.length === 0) {
      console.log("Aucun résultat trouvé après récupération des détails.");
      if (loadingMsg) loadingMsg.innerHTML = "Pas de résultats correspondants.";
      return [];
    }

    const moviesMap = processData(allBindings);

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
