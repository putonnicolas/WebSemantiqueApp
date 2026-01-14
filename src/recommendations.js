const SELECTED_MOVIES = [
  {
    id: "Q25150", // Inception
    title: "Inception",
    year: 2010,
    directorId: "Q212730",
    screenwriterId: "Q212730",
    genres: ["Q187439", "Q170584"],
    countryId: "Q30",
    languageId: "1860",
  },
  {
    id: "Q104123", // Pulp Fiction
    title: "Pulp Fiction",
    year: 1994,
    directorId: "Q3772",
    screenwriterId: "Q3772",
    genres: ["Q124422", "Q130232"],
    countryId: "Q30",
    languageId: "1860",
  },
  {
    id: "Q13551501", // Parasite
    title: "Parasite",
    year: 2019,
    directorId: "Q499876",
    screenwriterId: "Q499876",
    genres: ["Q130232", "Q170584", "Q132821"],
    countryId: "Q884",
    languageId: "9176",
  },
];

async function getOptimizedRecommendations() {
  const container = document.getElementById("results");
  const spinner = document.getElementById("spinner");
  const loadingMsg = document.getElementById("loadingMsg");

  if (container) container.innerHTML = "";
  if (spinner) spinner.style.display = "block";
  if (loadingMsg) {
    loadingMsg.style.display = "block";
    loadingMsg.innerHTML = "Recherche en cours...";
  }

  // 1. Préparation des IDs
  const directors = [...new Set(SELECTED_MOVIES.map((m) => `wd:${m.directorId}`))].join(" ");
  const genres = [...new Set(SELECTED_MOVIES.flatMap((m) => m.genres.map((g) => `wd:${g}`)))].join(" ");
  const excluded = SELECTED_MOVIES.map((m) => `wd:${m.id}`).join(" ");
  
  const minYear = Math.min(...SELECTED_MOVIES.map((m) => m.year)) - 10;
  const maxYear = Math.max(...SELECTED_MOVIES.map((m) => m.year)) + 10;

  // Requête originelle corrigée
  const sparqlQuery = `
SELECT ?movie ?movieLabel ?image ?year (SUM(?weight) AS ?score) WHERE {
  {
    { VALUES ?dir { ${directors} } ?movie wdt:P57 ?dir. BIND(5 AS ?weight) }
    UNION
    { VALUES ?gen { ${genres} } ?movie wdt:P136 ?gen. BIND(10 AS ?weight) }
  }

  ?movie wdt:P31 wd:Q11424.
  ?movie wdt:P577 ?date.
  BIND(YEAR(?date) AS ?year)
  FILTER(?year >= ${minYear} && ?year <= ${maxYear})
  
  OPTIONAL { ?movie wdt:P18 ?image. }
  
  # Exclusion des films déjà sélectionnés
  FILTER NOT EXISTS { VALUES ?original { ${excluded} } FILTER(?movie = ?original) }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
GROUP BY ?movie ?movieLabel ?image ?year
ORDER BY DESC(?score) DESC(?year)
LIMIT 12`;

  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparqlQuery);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    
    if (!response.ok) throw new Error("Erreur lors de la requête");

    const data = await response.json();

    if (spinner) spinner.style.display = "none";
    if (loadingMsg) loadingMsg.style.display = "none";
    
    renderMovies(data.results.bindings);
  } catch (error) {
    console.error("Erreur:", error);
    if (spinner) spinner.style.display = "none";
    if (loadingMsg) loadingMsg.innerHTML = "Erreur de connexion. Assurez-vous d'être sur un serveur local.";
  }
}

function renderMovies(movies) {
  const container = document.getElementById("results");
  if (!container) return;

  if (movies.length === 0) {
    container.innerHTML = "<p>Aucun film similaire trouvé.</p>";
    return;
  }

  movies.forEach((m) => {
    const img = m.image ? m.image.value : "https://via.placeholder.com/300x450?text=Pas+d'affiche";
    const card = document.createElement("div");
    card.className = "card";
    card.style = "border: 1px solid #ccc; padding: 10px; margin: 5px; width: 200px; display: inline-block; vertical-align: top;";
    card.innerHTML = `
            <img src="${img}" alt="${m.movieLabel.value}" style="width: 100%;">
            <div class="card-content">
                <div class="card-title" style="font-weight: bold;">${m.movieLabel.value}</div>
                <div class="card-meta">${m.year.value} • <b>Score: ${m.score.value}</b></div>
            </div>
        `;
    container.appendChild(card);
  });
}

document.getElementById("btnSearch")?.addEventListener("click", getOptimizedRecommendations);
