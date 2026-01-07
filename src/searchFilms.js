document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsTable = document.getElementById('resultsTable');
    const resultsBody = document.getElementById('resultsBody');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const wikidataEndpoint = 'https://query.wikidata.org/sparql';

    searchBtn.addEventListener('click', () => {
        const queryTerm = searchInput.value.trim();
        if (!queryTerm) return;

        // Reset
        loadingIndicator.style.display = 'inline';
        resultsTable.style.display = 'none';
        resultsBody.innerHTML = '';
        searchBtn.disabled = true;

        // Requête SPARQL optimisée : on demande tout d'un coup
        const sparqlQuery = `
            SELECT DISTINCT ?item ?itemLabel ?genreLabel ?date ?description WHERE {
              ?item wdt:P31 wd:Q11424 .
              ?item rdfs:label ?itemLabel .
              FILTER (lang(?itemLabel) = "fr")
              FILTER (regex(?itemLabel, "${queryTerm}", "i"))
              
              OPTIONAL { 
                ?item wdt:P136 ?genre . 
                ?genre rdfs:label ?genreLabel . 
                FILTER(lang(?genreLabel) = "fr") 
              }
              OPTIONAL { ?item wdt:P577 ?date . }
              OPTIONAL { 
                ?item schema:description ?description . 
                FILTER(lang(?description) = "fr") 
              }
              
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
                    resultsTable.style.display = 'table';
                    
                    // Regroupement manuel des genres pour éviter les lignes en double
                    const movies = new Map();

                    bindings.forEach(bind => {
                        const id = bind.item.value;
                        if (!movies.has(id)) {
                            movies.set(id, {
                                title: bind.itemLabel.value,
                                genres: new Set(),
                                date: bind.date ? bind.date.value.substring(0, 4) : 'N/A',
                                desc: bind.description ? bind.description.value : 'Film répertorié sur Wikidata.'
                            });
                        }
                        if (bind.genreLabel) movies.get(id).genres.add(bind.genreLabel.value);
                    });

                    // Affichage
                    movies.forEach(movie => {
                        const row = resultsBody.insertRow();
                        row.insertCell(0).innerHTML = `<strong>${movie.title}</strong>`;
                        row.insertCell(1).textContent = Array.from(movie.genres).join(', ') || 'N/A';
                        row.insertCell(2).textContent = movie.date;
                        row.insertCell(3).textContent = movie.desc;
                    });
                } else {
                    alert("Aucun film trouvé.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erreur de connexion. Vérifiez votre débit ou le terme recherché.");
            })
            .finally(() => {
                loadingIndicator.style.display = 'none';
                searchBtn.disabled = false;
            });
    });
});
