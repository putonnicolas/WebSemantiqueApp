const SELECTED_MOVIES = [
    { id: 'Q110478', directorId: 'Q25191', genres: ['Q204456', 'Q170201'], year: 2010 },
    { id: 'Q185161', directorId: 'Q184870', genres: ['Q170201', 'Q8253'], year: 1982 }
];

async function getOptimizedRecommendations() {
    const container = document.getElementById('results');
    const spinner = document.getElementById('spinner');
    const loadingMsg = document.getElementById('loadingMsg');

    container.innerHTML = '';
    spinner.style.display = 'block';
    loadingMsg.style.display = 'block';

    // 1. On prépare les listes d'IDs pour la requête
    const directors = [...new Set(SELECTED_MOVIES.map(m => `wd:${m.directorId}`))].join(' ');
    const genres = [...new Set(SELECTED_MOVIES.flatMap(m => m.genres.map(g => `wd:${g}`)))].join(' ');
    const excluded = SELECTED_MOVIES.map(m => `wd:${m.id}`).join(' ');

    // 2. On calcule la plage de dates (ex: de la date min-10 à max+10)
    const years = SELECTED_MOVIES.map(m => m.year);
    const minYear = Math.min(...years) - 10;
    const maxYear = Math.max(...years) + 10;

    const sparqlQuery = `
    SELECT DISTINCT ?movie ?movieLabel ?image ?year (SUM(?weight) AS ?score) WHERE {
      {
        # Correspondance par réalisateur (Poids fort : 5)
        VALUES ?dir { ${directors} }
        ?movie wdt:P57 ?dir.
        BIND(5 AS ?weight)
      }
      UNION
      {
        # Correspondance par genre (Poids : 1 par genre en commun)
        VALUES ?gen { ${genres} }
        ?movie wdt:P136 ?gen.
        BIND(1 AS ?weight)
      }

      # Filtres de base
      ?movie wdt:P31 wd:Q11424. # Doit être un film
      ?movie wdt:P577 ?date.
      BIND(YEAR(?date) AS ?year)
      
      # Optimisation : On filtre par date AVANT de demander le label
      FILTER(?year >= ${minYear} && ?year <= ${maxYear})
      
      # Exclusion des films déjà dans ta liste
      FILTER NOT EXISTS { VALUES ?original { ${excluded} } FILTER(?movie = ?original) }

      OPTIONAL { ?movie wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }
    GROUP BY ?movie ?movieLabel ?image ?year
    ORDER BY DESC(?score) DESC(?year)
    LIMIT 12`;

    const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparqlQuery);

    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        const data = await response.json();
        
        spinner.style.display = 'none';
        loadingMsg.style.display = 'none';
        renderMovies(data.results.bindings);
    } catch (error) {
        console.error("Erreur:", error);
        spinner.style.display = 'none';
        loadingMsg.innerHTML = "Erreur lors de la récupération.";
    }
}

function renderMovies(movies) {
    const container = document.getElementById('results');
    if (movies.length === 0) {
        container.innerHTML = "<p>Aucun film similaire trouvé.</p>";
        return;
    }

    movies.forEach(m => {
        const img = m.image ? m.image.value : 'https://via.placeholder.com/300x450?text=Pas+d\'affiche';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${img}" alt="${m.movieLabel.value}">
            <div class="card-content">
                <div class="card-title">${m.movieLabel.value}</div>
                <div class="card-meta">${m.year.value} • Score: ${m.score.value}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

document.getElementById('btnSearch').addEventListener('click', getOptimizedRecommendations);
