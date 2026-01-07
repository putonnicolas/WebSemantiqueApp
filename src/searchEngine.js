// Configuration
const DBPEDIA_ENDPOINT = "https://dbpedia.org/sparql";
const INPUT_DELAY = 500; // 0.5s

const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results');
const loadingDiv = document.getElementById('loading');

let debounceTimer;

// Écouteur pour lancer la recherche après 0.5s
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (term.length < 3) {
        resultsContainer.innerHTML = '';
        return;
    }

    debounceTimer = setTimeout(() => {
        fetchFilms(term);
    }, INPUT_DELAY);
});

async function fetchFilms(term) {
    loadingDiv.style.display = 'block';
    resultsContainer.innerHTML = '';

    // --- REQUÊTE SPARQL ---
    const sparqlQuery = `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?label ?abstract ?comment ?thumbnail ?genreLabel ?date
        WHERE {
            ?film a dbo:Film ;
                  rdfs:label ?label .
            
            # Filtre pour éviter les pages vides (redirections)
            FILTER NOT EXISTS { ?film dbo:wikiPageRedirects ?redirect }

            # Filtre sur le titre entré par l'utilisateur (insensible à la casse)
            FILTER(REGEX(?label, "${term}", "i"))
            FILTER(lang(?label) = 'en')

            # Récupération optionnelle de la date
            OPTIONAL { ?film dbo:releaseDate ?date }

            # Récupération optionnelle du résumé
            OPTIONAL { 
                ?film dbo:abstract ?abstract . 
                FILTER(lang(?abstract) = 'en') 
            }
            
            # Fallback: Commentaire si pas de résumé
            OPTIONAL { 
                ?film rdfs:comment ?comment . 
                FILTER(lang(?comment) = 'en') 
            }
            
            # --- C'EST ICI QUE L'ON RECUPERE L'IMAGE ---
            OPTIONAL { ?film dbo:thumbnail ?thumbnail }
            
            # Récupération optionnelle du genre
            OPTIONAL { 
                ?film dbo:genre ?genre . 
                ?genre rdfs:label ?genreLabel .
                FILTER(lang(?genreLabel) = 'en')
            }
        }
        LIMIT 10
    `;

    const url = new URL(DBPEDIA_ENDPOINT);
    url.searchParams.append("default-graph-uri", "http://dbpedia.org");
    url.searchParams.append("query", sparqlQuery);
    url.searchParams.append("format", "application/json");

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur réseau");
        
        const data = await response.json();
        displayResults(data.results.bindings);
    } catch (error) {
        console.error("Erreur SPARQL:", error);
        resultsContainer.innerHTML = '<p>Erreur lors de la récupération des données.</p>';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayResults(bindings) {
    if (bindings.length === 0) {
        resultsContainer.innerHTML = '<p>Aucun résultat trouvé pour cette recherche.</p>';
        return;
    }

    bindings.forEach(item => {
        // Traitement des données (gestion des valeurs manquantes)
        const title = item.label ? item.label.value : "Sans titre";
        
        // Choix du texte : abstract OU comment OU texte par défaut
        let descText = item.abstract ? item.abstract.value : (item.comment ? item.comment.value : "Pas de description disponible.");
        if (descText.length > 150) descText = descText.substring(0, 150) + "...";

        // --- GESTION DE L'IMAGE ICI ---
        // Si ?thumbnail existe, on prend sa valeur, sinon une image grise par défaut
        const imgSrc = item.thumbnail ? item.thumbnail.value : "https://via.placeholder.com/200x150?text=No+Image";
        
        const genre = item.genreLabel ? item.genreLabel.value : "Non spécifié";
        // Formatage simple de la date (juste l'année si possible, sinon la date complète)
        let dateStr = item.date ? item.date.value : "Date inconnue";
        if(dateStr !== "Date inconnue" && dateStr.length >= 4) {
             dateStr = dateStr.substring(0, 4); // On garde juste l'année
        }

        // Création de la carte HTML
        const card = document.createElement('div');
        card.className = 'card';
        // --- INSERTION DE L'IMAGE DANS LE HTML ---
        card.innerHTML = `
            <img src="${imgSrc}" alt="${title}">
            <h3>${title}</h3>
            <p style="font-size:0.8em; color:#777; margin-bottom:5px;">📅 Année : ${dateStr}</p>
            <p class="genre">🎬 Genre : ${genre}</p>
            <p class="desc">${descText}</p>
        `;
        
        resultsContainer.appendChild(card);
    });
}
