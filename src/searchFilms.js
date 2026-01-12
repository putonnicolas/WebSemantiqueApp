document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsTable = document.getElementById('resultsTable');
    const resultsBody = document.getElementById('resultsBody');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const wikidataEndpoint = 'https://query.wikidata.org/sparql';

    // Cette variable stockera vos objets propres en mémoire
    let moviesLibrary = [];

    searchBtn.addEventListener('click', () => {
        const queryTerm = searchInput.value.trim();
        if (!queryTerm) return;

        loadingIndicator.style.display = 'inline';
        resultsTable.style.display = 'none';
        resultsBody.innerHTML = '';
        searchBtn.disabled = true;

        // Requête incluant les URIs (?genre, ?director) pour extraire les IDs
        const sparqlQuery = `
            SELECT DISTINCT ?item ?itemLabel ?genre ?genreLabel ?director ?directorLabel ?date WHERE {
              ?item wdt:P31 wd:Q11424 .
              ?item rdfs:label ?itemLabel .
              FILTER (lang(?itemLabel) = "fr")
              FILTER (regex(?itemLabel, "${queryTerm}", "i"))
              
              OPTIONAL { 
                ?item wdt:P136 ?genre . 
                ?genre rdfs:label ?genreLabel . 
                FILTER(lang(?genreLabel) = "fr") 
              }
              OPTIONAL { 
                ?item wdt:P57 ?director . 
                ?director rdfs:label ?directorLabel . 
                FILTER(lang(?directorLabel) = "fr") 
              }
              OPTIONAL { ?item wdt:P577 ?date . }
              
              SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
            }
            ORDER BY DESC(?date)
            LIMIT 20
        `;

        const url = wikidataEndpoint + "?query=" + encodeURIComponent(sparqlQuery) + "&format=json&origin=*";

        fetch(url)
            .then(res => res.json())
            .then(data => {
                const bindings = data.results.bindings;
                
                if (bindings.length > 0) {
                    // ÉTAPE 1 : TRAITEMENT ET STOCKAGE
                    const moviesMap = processData(bindings);
                    
                    // On transforme la Map en tableau d'objets simples pour la "mémoire"
                    moviesLibrary = Array.from(moviesMap.values()).map(m => ({
                        id: m.id,
                        directorId: m.directorId,
                        genres: Array.from(m.genresIds),
                        year: m.year
                    }));

                    console.log("Bibliothèque en mémoire :", moviesLibrary);

                    // ÉTAPE 2 : AFFICHAGE DU TABLEAU
                    displayTable(moviesMap);
                    
                } else {
                    alert("Aucun film trouvé.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erreur lors de la récupération des données.");
            })
            .finally(() => {
                loadingIndicator.style.display = 'none';
                searchBtn.disabled = false;
            });
    });

    /**
     * Transforme les résultats bruts de Wikidata en une Map structurée
     */
    function processData(bindings) {
        const moviesMap = new Map();

        bindings.forEach(bind => {
            const qid = bind.item.value.split('/').pop();
            
            if (!moviesMap.has(qid)) {
                moviesMap.set(qid, {
                    id: qid,
                    title: bind.itemLabel.value,
                    directorName: bind.directorLabel ? bind.directorLabel.value : 'Inconnu',
                    directorId: bind.director ? bind.director.value.split('/').pop() : null,
                    genresLabels: new Set(),
                    genresIds: new Set(),
                    year: bind.date ? parseInt(bind.date.value.substring(0, 4)) : 'N/A'
                });
            }

            if (bind.genreLabel) {
                moviesMap.get(qid).genresLabels.add(bind.genreLabel.value);
                moviesMap.get(qid).genresIds.add(bind.genre.value.split('/').pop());
            }
        });

        return moviesMap;
    }

    /**
     * Gère l'affichage HTML dans le tableau
     */
    function displayTable(moviesMap) {
        resultsTable.style.display = 'table';
        resultsBody.innerHTML = ''; // Sécurité

        moviesMap.forEach(movie => {
            const row = resultsBody.insertRow();
            
            // Colonne ID
            row.insertCell(0).innerHTML = `<small class="text-muted">${movie.id}</small>`;
            
            // Colonne Titre
            row.insertCell(1).innerHTML = `<strong>${movie.title}</strong>`;
            
            // Colonne Genres (Labels)
            row.insertCell(2).textContent = Array.from(movie.genresLabels).join(', ') || 'N/A';
            
            // Colonne Réalisateur
            row.insertCell(3).textContent = movie.directorName;
            
            // Colonne Année
            row.insertCell(4).textContent = movie.year;
        });
    }
});
