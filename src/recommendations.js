const SELECTED_MOVIES = [
  {
    id: "Q25150",
    title: "Inception",
    year: 2010,
    directorId: "Q212730",
    screenwriterId: "Q212730",
    genres: ["Q187439", "Q170584"],
    cast: ["Q38111", "Q188573"],
    countryId: "Q30",
    languageId: "Q1860",
  },
  {
    id: "Q104123",
    title: "Pulp Fiction",
    year: 1994,
    directorId: "Q3772",
    screenwriterId: "Q3772",
    genres: ["Q124422", "Q130232"],
    cast: ["Q125217", "Q172678"],
    countryId: "Q30",
    languageId: "Q1860",
  },
  {
    id: "Q13551501",
    title: "Parasite",
    year: 2019,
    directorId: "Q499876",
    screenwriterId: "Q499876",
    genres: ["Q130232", "Q170584", "Q132821"],
    cast: ["Q495284", "Q484822"],
    countryId: "Q884",
    languageId: "Q9176",
  },
];

const WEIGHTS = {
  GENRE: 10,
  DIRECTOR: 15,
  SCREENWRITER: 10,
  CAST: 8,
  COUNTRY: 5,
  LANGUAGE: 5,
};

// Récupération des films depuis le sessionStorage
let savedMovies = JSON.parse(sessionStorage.getItem('moviesUsed')) || []

async function getOptimizedRecommendations() {
  // Vérifier qu'il y a des films sélectionnés
  if (savedMovies.length === 0) {
    const container = document.getElementById("results");
    if (container) {
      container.innerHTML = "<p>Aucun film sélectionné. Retournez à la page d'accueil pour ajouter des films à votre liste.</p>";
    }
    return;
  }
  // Récupérer les films sélectionnés depuis le sessionStorage
  const SELECTED_MOVIES = savedMovies;

  const container = document.getElementById("results");
  const loadingMsg = document.getElementById("loadingMsg");
  
  console.log("getOptimizedRecommendations appelé");
  console.log("Container trouvé:", !!container);
  
  if (container) container.innerHTML = "";
  if (loadingMsg) {
    loadingMsg.style.display = "block";
    loadingMsg.innerHTML = "Recherche des acteurs et des films en cours...";
  } else {
    console.log("loadingMsg non trouvé");
  }

  const criteria = {
    directors: new Set(SELECTED_MOVIES.map((m) => m.directorId)),
    screenwriters: new Set(SELECTED_MOVIES.map((m) => m.screenwriterId)),
    genres: new Set(SELECTED_MOVIES.flatMap((m) => m.genres)),
    actors: new Set(SELECTED_MOVIES.flatMap((m) => m.cast)), // Liste des acteurs cibles
    countries: new Set(SELECTED_MOVIES.map((m) => m.countryId)),
    languages: new Set(SELECTED_MOVIES.map((m) => m.languageId)),
    excluded: new Set(SELECTED_MOVIES.map((m) => m.id)),
  };

  const minYear = Math.min(...SELECTED_MOVIES.map((m) => m.year)) - 15;
  const maxYear = Math.max(...SELECTED_MOVIES.map((m) => m.year)) + 5;

  const sparqlQuery = `
SELECT DISTINCT ?movie ?movieLabel ?year ?image ?dirId ?scrId ?cntId ?lngId ?genId ?actId WHERE {
  {
    { ?movie wdt:P136 ?genSearch. VALUES ?genSearch { ${[...criteria.genres].map((g) => `wd:${g}`).join(" ")} } }
    UNION
    { ?movie wdt:P57 ?dirSearch. VALUES ?dirSearch { ${[...criteria.directors].map((d) => `wd:${d}`).join(" ")} } }
  }
  
  ?movie wdt:P31 wd:Q11424;
         wdt:P577 ?date.
  BIND(YEAR(?date) AS ?year)
  FILTER(?year >= ${minYear} && ?year <= ${maxYear})

  OPTIONAL { ?movie wdt:P18 ?image. }
  OPTIONAL { ?movie wdt:P57 ?d. BIND(STRAFTER(STR(?d), "entity/") AS ?dirId) }
  OPTIONAL { ?movie wdt:P58 ?s. BIND(STRAFTER(STR(?s), "entity/") AS ?scrId) }
  OPTIONAL { ?movie wdt:P495 ?c. BIND(STRAFTER(STR(?c), "entity/") AS ?cntId) }
  OPTIONAL { ?movie wdt:P364 ?l. BIND(STRAFTER(STR(?l), "entity/") AS ?lngId) }
  OPTIONAL { ?movie wdt:P136 ?g. BIND(STRAFTER(STR(?g), "entity/") AS ?genId) }
  
  OPTIONAL { 
    ?movie wdt:P161 ?actor. 
    VALUES ?actor { ${[...criteria.actors].map((a) => `wd:${a}`).join(" ")} }
    BIND(STRAFTER(STR(?actor), "entity/") AS ?actId)
  }

  FILTER NOT EXISTS { VALUES ?err { ${[...criteria.excluded].map((e) => `wd:${e}`).join(" ")} } FILTER(?movie = ?err) }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 500`;

  try {
    const response = await fetch(
      "https://query.wikidata.org/sparql?format=json&query=" +
        encodeURIComponent(sparqlQuery),
      {
        headers: { Accept: "application/sparql-results+json" },
      },
    );
    const data = await response.json();
    const rows = data.results.bindings;

    const movieMap = new Map();

    rows.forEach((row) => {
      const id = row.movie.value.split("/").pop();
      if (!movieMap.has(id)) {
        movieMap.set(id, {
          title: row.movieLabel.value,
          year: row.year.value,
          image: row.image?.value || null,
          directors: new Set(),
          screenwriters: new Set(),
          countries: new Set(),
          languages: new Set(),
          genres: new Set(),
          actors: new Set(),
        });
      }
      const m = movieMap.get(id);
      if (row.dirId) m.directors.add(row.dirId.value);
      if (row.scrId) m.screenwriters.add(row.scrId.value);
      if (row.cntId) m.countries.add(row.cntId.value);
      if (row.lngId) m.languages.add(row.lngId.value);
      if (row.genId) m.genres.add(row.genId.value);
      if (row.actId) m.actors.add(row.actId.value);
    });

    const finalResults = Array.from(movieMap.values()).map((movie) => {
      let score = 0;
      let reasons = new Set();

      movie.genres.forEach((g) => {
        if (criteria.genres.has(g)) {
          score += WEIGHTS.GENRE;
          reasons.add("genre");
        }
      });
      movie.directors.forEach((d) => {
        if (criteria.directors.has(d)) {
          score += WEIGHTS.DIRECTOR;
          reasons.add("réalisateur");
        }
      });
      movie.screenwriters.forEach((s) => {
        if (criteria.screenwriters.has(s)) {
          score += WEIGHTS.SCREENWRITER;
          reasons.add("scénariste");
        }
      });
      movie.countries.forEach((c) => {
        if (criteria.countries.has(c)) {
          score += WEIGHTS.COUNTRY;
          reasons.add("pays");
        }
      });
      movie.languages.forEach((l) => {
        if (criteria.languages.has(l)) {
          score += WEIGHTS.LANGUAGE;
          reasons.add("langue");
        }
      });
      movie.actors.forEach((a) => {
        if (criteria.actors.has(a)) {
          score += WEIGHTS.CAST;
          reasons.add("casting");
        }
      });

      return {
        ...movie,
        recommendation: { score, reasons: Array.from(reasons) },
      };
    });

    finalResults.sort(
      (a, b) =>
        b.recommendation.score - a.recommendation.score || b.year - a.year,
    );

    if (loadingMsg) loadingMsg.style.display = "none";
    renderTable(finalResults.slice(0, 15));
  } catch (error) {
    console.error("Erreur:", error);
    if (loadingMsg)
      loadingMsg.innerHTML = "Délai d'attente dépassé. Réessayez.";
  }
}

function renderTable(movies) {
  const container = document.getElementById("results");
  
  const html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 20px;">
      ${movies.map((m) => `
        <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s;">
          ${m.image ? `<img src="${m.image}" alt="${m.title}" style="width: 100%; height: 300px; object-fit: cover;">` : `<div style="width: 100%; height: 300px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">Pas d'image</div>`}
          <div style="padding: 15px;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333;">${m.title}</h3>
            <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Année:</strong> ${m.year}</p>
            <p style="margin: 5px 0; color: #d32f2f; font-size: 14px;"><strong>Score:</strong> ${m.recommendation.score}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
  
  container.innerHTML = html;
}

// Afficher les films sélectionnés dans le panneau de gauche
function updateSavedListUI() {
  const placeholders = document.querySelectorAll('.movie-placeholder')

  placeholders.forEach(p => {
    p.classList.remove('filled')
    p.innerHTML = ""
  })

  savedMovies.forEach((film, index) => {
    if (index < placeholders.length) {
      const p = placeholders[index]
      p.classList.add('filled')
      p.innerHTML = `
        <div class="mini-card">
          <img src="${film.image}" alt="${film.title}">
          <div class="mini-card-info">
            <span class="mini-title">${film.title}</span>
          </div>
        </div>
      `
    }
  })
}

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI()
  getOptimizedRecommendations()
})

document
  .getElementById("btnSearch")
  ?.addEventListener("click", getOptimizedRecommendations);

// Initialiser le chargement au démarrage de la page
window.addEventListener("DOMContentLoaded", () => {
  console.log("Page chargée, affichage des résultats de test...");
  
  // Afficher directement les résultats de test
  const testMovies = SELECTED_MOVIES.map(m => ({
    ...m,
    image: null,
    recommendation: { score: 20, reasons: ["test"] }
  }));
  
  renderTable(testMovies);
});
