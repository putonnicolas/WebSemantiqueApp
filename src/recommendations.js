const SELECTED_MOVIES = [
  {
    id: "Q25150", // Inception
    title: "Inception",
    year: 2010,
    directorId: "Q212730", // Christopher Nolan
    screenwriterId: "Q212730", // Christopher Nolan
    genres: ["Q187439", "Q170584"], // Science-fiction, Thriller
    countryId: "Q30", // États-Unis
    languageId: "Q1860", // Anglais
  },
  {
    id: "Q104123", // Pulp Fiction
    title: "Pulp Fiction",
    year: 1994,
    directorId: "Q3772", // Quentin Tarantino
    screenwriterId: "Q3772", // Quentin Tarantino
    genres: ["Q124422", "Q130232"], // Film policier, Drame
    countryId: "Q30", // États-Unis
    languageId: "Q1860", // Anglais
  },
  {
    id: "Q13551501", // Parasite
    title: "Parasite",
    year: 2019,
    directorId: "Q499876", // Bong Joon-ho
    screenwriterId: "Q499876", // Bong Joon-ho
    genres: ["Q130232", "Q170584", "Q132821"], // Drame, Thriller, Comédie noire
    countryId: "Q884", // Corée du Sud
    languageId: "Q9176", // Coréen
  },
];

/**
 * Fonction principale pour récupérer et formater les recommandations
 */
async function getOptimizedRecommendations() {
  const container = document.getElementById("results");
  const spinner = document.getElementById("spinner");
  const loadingMsg = document.getElementById("loadingMsg");

  container.innerHTML = "";
  if (spinner) spinner.style.display = "block";
  if (loadingMsg) {
    loadingMsg.style.display = "block";
    loadingMsg.innerHTML = "Analyse de vos goûts en cours...";
  }

  // 1. Préparation des IDs pour la requête
  const directors = [...new Set(SELECTED_MOVIES.map((m) => `wd:${m.directorId}`))].join(" ");
  const genres = [...new Set(SELECTED_MOVIES.flatMap((m) => m.genres.map((g) => `wd:${g}`)))].join(" ");
  const excluded = SELECTED_MOVIES.map((m) => `wd:${m.id}`).join(" ");
  const screenwriters = [...new Set(SELECTED_MOVIES.map((m) => `wd:${m.screenwriterId}`))].join(" ");
  const countries = [...new Set(SELECTED_MOVIES.map((m) => `wd:${m.countryId}`))].join(" ");
  const languages = [...new Set(SELECTED_MOVIES.map((m) => `wd:${m.languageId}`))].join(" ");

  const minYear = Math.min(...SELECTED_MOVIES.map((m) => m.year)) - 10;
  const maxYear = Math.max(...SELECTED_MOVIES.map((m) => m.year)) + 10;

  // 2. Requête SPARQL enrichie pour récupérer les labels
  const sparqlQuery = `
SELECT 
  ?movie ?movieLabel ?year ?image ?score
  ?directorId ?directorLabel
  ?screenwriterId ?screenwriterLabel
  ?countryId ?languageId
  (GROUP_CONCAT(DISTINCT ?genreId; separator="|") AS ?genreIds)
  (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genreLabels)
WHERE {
  {
    SELECT ?movie (SUM(?weight) AS ?score) WHERE {
      {
        { VALUES ?dir { ${directors} } ?movie wdt:P57 ?dir. BIND(5 AS ?weight) }
        UNION
        { VALUES ?gen { ${genres} } ?movie wdt:P136 ?gen. BIND(10 AS ?weight) }
        UNION
        { VALUES ?writer { ${screenwriters} } ?movie wdt:P58 ?writer. BIND(5 AS ?weight) }
      }
      ?movie wdt:P31 wd:Q11424.
      ?movie wdt:P577 ?date.
      FILTER(YEAR(?date) >= ${minYear} && YEAR(?date) <= ${maxYear})
    } GROUP BY ?movie
  }

  ?movie rdfs:label ?movieLabel. FILTER(LANG(?movieLabel) = "fr").
  ?movie wdt:P577 ?date. BIND(YEAR(?date) AS ?year).
  
  OPTIONAL { ?movie wdt:P57 ?dir. ?dir rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "fr"). BIND(REPLACE(STR(?dir), ".*Q", "Q") AS ?directorId) }
  OPTIONAL { ?movie wdt:P58 ?scr. ?scr rdfs:label ?screenwriterLabel. FILTER(LANG(?screenwriterLabel) = "fr"). BIND(REPLACE(STR(?scr), ".*Q", "Q") AS ?screenwriterId) }
  OPTIONAL { ?movie wdt:P495 ?cnt. BIND(REPLACE(STR(?cnt), ".*Q", "Q") AS ?countryId) }
  OPTIONAL { ?movie wdt:P364 ?lng. BIND(REPLACE(STR(?lng), ".*Q", "Q") AS ?languageId) }
  OPTIONAL { 
    ?movie wdt:P136 ?g. ?g rdfs:label ?gLabel. FILTER(LANG(?gLabel) = "fr"). 
    BIND(REPLACE(STR(?g), ".*Q", "Q") AS ?genreId)
    BIND(STR(?gLabel) AS ?genreLabel)
  }
  
  OPTIONAL { ?movie wdt:P18 ?image. }
  
  FILTER NOT EXISTS { VALUES ?original { ${excluded} } FILTER(?movie = ?original) }
}
GROUP BY ?movie ?movieLabel ?year ?image ?score ?directorId ?directorLabel ?screenwriterId ?screenwriterLabel ?countryId ?languageId
ORDER BY DESC(?score)
LIMIT 12`;

  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparqlQuery);

  try {
    const response = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
    const data = await response.json();

    // 3. Transformation en JSON structuré
    const recommendedMovies = formatRecommendations(data.results.bindings, SELECTED_MOVIES);
    
    console.log("Films Recommandés (JSON):", recommendedMovies);

    if (spinner) spinner.style.display = "none";
    if (loadingMsg) loadingMsg.style.display = "none";
    
    renderMovies(recommendedMovies);
  } catch (error) {
    console.error("Erreur:", error);
    if (spinner) spinner.style.display = "none";
    if (loadingMsg) loadingMsg.innerHTML = "Erreur lors de la récupération.";
  }
}

/**
 * Transforme les résultats SPARQL en tableau JSON avec analyse des points communs
 */
function formatRecommendations(sparqlResults, selectedMovies) {
  return sparqlResults.map((row) => {
    const movieData = {
      id: row.movie.value.split("/").pop(),
      title: row.movieLabel.value,
      year: parseInt(row.year.value),
      directorId: row.directorId?.value || null,
      screenwriterId: row.screenwriterId?.value || null,
      genres: row.genreIds ? row.genreIds.value.split("|") : [],
      countryId: row.countryId?.value || null,
      languageId: row.languageId?.value || null,
      recommendationInfos: {
        scoreTotal: parseInt(row.score.value),
        raisons: {},
      },
    };

    const raisons = movieData.recommendationInfos.raisons;

    // --- ANALYSE DES RAISONS ---

    // 1. Réalisateur Commun
    if (movieData.directorId && selectedMovies.some(m => m.directorId === movieData.directorId)) {
      raisons.realisateurCommun = {
        points: 5,
        details: [row.directorLabel?.value || "Inconnu"]
      };
    }

    // 2. Genres Communs
    const selectedGenres = [...new Set(selectedMovies.flatMap(m => m.genres))];
    const movieGenreIds = movieData.genres;
    const movieGenreLabels = row.genreLabels ? row.genreLabels.value.split("|") : [];
    
    const commonLabels = [];
    movieGenreIds.forEach((id, index) => {
      if (selectedGenres.includes(id)) {
        commonLabels.push(movieGenreLabels[index]);
      }
    });

    if (commonLabels.length > 0) {
      raisons.genresCommuns = {
        points: commonLabels.length * 10,
        details: commonLabels
      };
    }

    // 3. Scénariste Commun
    if (movieData.screenwriterId && selectedMovies.some(m => m.screenwriterId === movieData.screenwriterId)) {
      raisons.scenaristeCommun = {
        points: 5,
        details: [row.screenwriterLabel?.value || "Inconnu"]
      };
    }

    // 4. Pays / Langue
    if (selectedMovies.some(m => m.countryId === movieData.countryId)) {
      raisons.paysCommun = { points: 2, details: ["Même pays d'origine"] };
    }

    movieData.image = row.image?.value || "https://via.placeholder.com/300x450?text=Pas+d'affiche";

    return movieData;
  });
}

/**
 * Affiche les cartes dans le DOM
 */
function renderMovies(movies) {
  const container = document.getElementById("results");
  if (movies.length === 0) {
    container.innerHTML = "<p>Aucun film similaire trouvé.</p>";
    return;
  }

  movies.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${m.image}" alt="${m.title}">
            <div class="card-content">
                <div class="card-title">${m.title}</div>
                <div class="card-meta">${m.year} • <b>Score: ${m.recommendationInfos.scoreTotal}</b></div>
                <div style="font-size: 0.8em; color: #666; margin-top: 5px;">
                   ${Object.keys(m.recommendationInfos.raisons).length} critère(s) matché(s)
                </div>
            </div>
        `;
    container.appendChild(card);
  });
}

// Initialisation
document.getElementById("btnSearch")?.addEventListener("click", getOptimizedRecommendations);
