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

async function getOptimizedRecommendations() {
  const container = document.getElementById("results");
  const loadingMsg = document.getElementById("loadingMsg");
  if (container) container.innerHTML = "";
  if (loadingMsg) {
    loadingMsg.style.display = "block";
    loadingMsg.innerHTML = "Recherche des acteurs et des films en cours...";
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
  let html = `<table style="width:100%; border-collapse:collapse; font-family:sans-serif;">
    <thead>
      <tr style="background:#f4f4f4; border-bottom:2px solid #ccc;">
        <th style="padding:10px; text-align:left;">Film</th>
        <th style="padding:10px; text-align:center;">Score</th>
        <th style="padding:10px; text-align:left;">Raisons</th>
      </tr>
    </thead>
    <tbody>`;

  movies.forEach((m) => {
    const badges = m.recommendation.reasons
      .map(
        (r) =>
          `<span style="background:#fff9c4; color:#f57f17; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-right:5px; border:1px solid #fbc02d;">${r}</span>`,
      )
      .join("");

    html += `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px;"><b>${m.title}</b> (${m.year})</td>
      <td style="padding:10px; text-align:center; font-weight:bold; color:#d32f2f;">${m.recommendation.score}</td>
      <td style="padding:10px;">${badges}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

document
  .getElementById("btnSearch")
  ?.addEventListener("click", getOptimizedRecommendations);
