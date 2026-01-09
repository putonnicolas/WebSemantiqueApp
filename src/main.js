import "../style.css";
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

  try {
    const films = await client.query(maRequete);

    if (!films || films.length === 0) {
      resultsDiv.innerHTML = "<p>Aucun résultat trouvé.</p>";
      return;
    }

    let html = "";
    films.forEach((film) => {
      const annee = film.date ? new Date(film.date).getFullYear() : "N/C";
      const imageSrc = film.image
        ? film.image
        : "https://via.placeholder.com/300x450?text=Pas+d'image";

      html += `
        <div class="film-card">
          <img src="${imageSrc}" alt="${film.filmLabel}" />
          <div class="film-info-overlay">
            <div class="info-text">
              <h3>${film.filmLabel}</h3>
              <span>${annee}</span>
            </div>
<button 
  class="add-btn" 
  onclick="ajouterAuxRecommandations('${film.filmLabel.replace(
    /'/g,
    "\\'"
  )}', '${film.image || ""}')"
>
  <img class="add-logo" src="add.svg" alt="Ajouter"/>
</button>          </div>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.innerHTML = "<p>Erreur lors de la récupération des données.</p>";
    console.error(error);
  }
}

document.querySelector("#searchBtn").addEventListener("click", lancerRecherche);


window.ajouterAuxRecommandations = function(titre, image) {
  const placeholders = document.querySelectorAll('.movie-placeholder');
  
  const premierLibre = Array.from(placeholders).find(p => !p.classList.contains('filled'));

  if (!premierLibre) {
    alert("Ta liste est complète ! Enlève un film pour en ajouter un nouveau.");
    return;
  }

  premierLibre.classList.add('filled');
  premierLibre.innerHTML = `
    <div class="mini-card">
      ${image ? `<img src="${image}" alt="${titre}">` : ''}
      <div class="mini-card-info">
        <span class="mini-title">${titre}</span>
        <button class="remove-btn" onclick="supprimerFilm(this)">×</button>
      </div>
    </div>
  `;
};


window.supprimerFilm = function(btn) {
  const allFilled = document.querySelectorAll('.movie-placeholder.filled');
  const filmsRestants = [];

  allFilled.forEach(p => {
    const card = p.querySelector('.mini-card');
    if (!p.contains(btn)) {
      filmsRestants.push({
        titre: card.querySelector('.mini-title').innerText,
        image: card.querySelector('img').src
      });
    }
  });

  const allPlaceholders = document.querySelectorAll('.movie-placeholder');
  allPlaceholders.forEach(p => {
    p.classList.remove('filled');
    p.innerHTML = "";
  });

  filmsRestants.forEach((film, index) => {
    allPlaceholders[index].classList.add('filled');
    allPlaceholders[index].innerHTML = `
      <div class="mini-card">
        <img src="${film.image}" alt="${film.titre}">
        <div class="mini-card-info">
          <span class="mini-title">${film.titre}</span>
          <button class="remove-btn" onclick="supprimerFilm(this)">×</button>
        </div>
      </div>
    `;
  });
};