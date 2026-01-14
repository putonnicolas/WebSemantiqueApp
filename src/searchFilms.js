document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('movieSearch');
    const resultsTable = document.getElementById('resultsTable');
    const resultsBody = document.getElementById('resultsBody');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const wikidataEndpoint = 'https://query.wikidata.org/sparql';

    // Essaie de récupération depuis le session storage
    let moviesLibrary = JSON.parse(sessionStorage.getItem('moviesLibrary')) || [];
    
    if (moviesLibrary.length > 0) {
        displayFromMemory(moviesLibrary); 
    }

    searchBtn.addEventListener('click', () => {
        const queryTerm = searchInput.value.trim();
        if (!queryTerm) return;

        loadingIndicator.style.display = 'inline';
        resultsTable.style.display = 'none';
        resultsBody.innerHTML = '';
        searchBtn.disabled = true;

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
                    const moviesMap = processData(bindings);
                    
                    // 2. STOCKAGE : On transforme en objet simple pour la mémoire ET le storage
                    // <--- MODIFICATION ICI : J'ai ajouté directorName et genresLabels pour l'affichage futur
                    moviesLibrary = Array.from(moviesMap.values()).map(m => ({
                        id: m.id,
                        title: m.title,
                        directorId: m.directorId,
                        directorName: m.directorName, // Important de garder le nom !
                        genresIds: Array.from(m.genresIds),
                        genresLabels: Array.from(m.genresLabels), // Important de garder les labels !
                        year: m.year
                    }));

                    // <--- SAUVEGARDE EN SESSION STORAGE ICI
                    sessionStorage.setItem('moviesLibrary', JSON.stringify(moviesLibrary));
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

    // Affiche depuis le fetch (Map complexe avec des Sets)
    function displayTable(moviesMap) {
        // On convertit la Map en Array pour utiliser la fonction générique
        const list = Array.from(moviesMap.values()).map(m => ({
            ...m,
            genresLabels: Array.from(m.genresLabels) // Conversion du Set en Array pour l'affichage
        }));
        displayFromMemory(list);
    }

    // 3. NOUVELLE FONCTION D'AFFICHAGE (Compatible mémoire & fetch)
    // Cette fonction prend un tableau simple en entrée
    function displayFromMemory(moviesArray) {
        resultsTable.style.display = 'table';
        resultsBody.innerHTML = '';

        moviesArray.forEach(movie => {
            const row = resultsBody.insertRow();
            
            row.insertCell(0).innerHTML = `<small class="text-muted">${movie.id}</small>`;
            row.insertCell(1).innerHTML = `<strong>${movie.title}</strong>`;
            // Ici on gère le fait que ce soit un tableau (Array)
            row.insertCell(2).textContent = movie.genresLabels.join(', ') || 'N/A';
            row.insertCell(3).textContent = movie.directorName;
            row.insertCell(4).textContent = movie.year;
        });
    }
});