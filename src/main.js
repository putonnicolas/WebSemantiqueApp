import "./style.css";
import { SparqlClient } from "./SparqlClient.js";

const wikidataUrl = "https://query.wikidata.org/sparql";
const client = new SparqlClient(wikidataUrl);

const maRequete = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?film ?filmLabel ?date ?image WHERE {
  ?film wdt:P31 wd:Q11424.

  OPTIONAL { ?film wdt:P577 ?date. }
  OPTIONAL { ?film wdt:P18 ?image. }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "fr,en".
  }
}
LIMIT 100
`;

async function lancerRecherche() {
  const resultsDiv = document.querySelector("#results");
  resultsDiv.innerHTML = "<p>Recherche en cours...</p>";

  const films = await client.query(maRequete);

  if (films.length === 0) {
    resultsDiv.innerHTML = "<p>Aucun résultat trouvé.</p>";
    return;
  }

  let html = '<h2>Films</h2><div class="films-grid">';
  films.forEach((film) => {
    html += `
            <div class="film-card">
                ${
                  film.image
                    ? `<img src="${film.image}" alt="${film.filmLabel}" />`
                    : ""
                }
                <h3>${film.filmLabel}</h3>
                ${
                  film.date
                    ? `<p>Date: ${new Date(film.date).getFullYear()}</p>`
                    : ""
                }
            </div>
        `;
  });
  html += "</div>";

  resultsDiv.innerHTML = html;
}

document.querySelector("#hero").innerHTML = `
  <div class="container">
    <h1>Recherche de Films - Web Sémantique</h1>
    <button id="searchBtn">Lancer la recherche</button>
    <div id="results"></div>
  </div>
`;


document.querySelector("#searchBtn").addEventListener("click", lancerRecherche);