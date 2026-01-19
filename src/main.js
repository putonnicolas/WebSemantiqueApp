import "../style.css";
import { searchMoviesOnWikidata } from "./searchFilms.js";

let currentSearchResults = [];
let savedMovies = JSON.parse(sessionStorage.getItem("moviesUsed")) || [];

document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI();

  document
    .querySelector("#searchBtn")
    .addEventListener("click", lancerRecherche);
  document.querySelector("#movieSearch").addEventListener("keypress", (e) => {
    if (e.key === "Enter") lancerRecherche();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI();

  const urlParams = new URLSearchParams(window.location.search);
  const searchTerm = urlParams.get('search');

  if (searchTerm) {
    document.querySelector("#movieSearch").value = searchTerm;
    lancerRecherche();
  }

  document.querySelector("#searchBtn").addEventListener("click", lancerRecherche);
  document.querySelector("#movieSearch").addEventListener("keypress", (e) => {
    if (e.key === "Enter") lancerRecherche();
  });
});

async function lancerRecherche() {
  const searchInput = document.querySelector("#movieSearch");
  const term = searchInput.value.trim();
  if (!term) return;

  if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
    window.location.href = `index.html?search=${encodeURIComponent(term)}`;
    return;
  }

  const resultsDiv = document.querySelector("#results");
  resultsDiv.innerHTML = '<div class="loader">Recherche en cours...</div>';

try {
    currentSearchResults = await searchMoviesOnWikidata(term);

    if (currentSearchResults.length === 0) {
      resultsDiv.innerHTML =
        "<p>Aucun résultat trouvé pour cette recherche.</p>";
      return;
    }
    
    let html = "";
    currentSearchResults.forEach((film, index) => {
      console.log(film);
      html += `
        <div class="film-card">
          
          ${film.image ? `<img src="${film.image}" alt="${film.title}"/>` : ""}
          
          <div class="film-info-overlay">
            
            <div class="info-text" onclick="ouvrirDetails(${index})">
              <h3>${film.title}</h3>
              <p>${film.director} - ${film.year}</p>
              
<<<<<<< HEAD
              <small>${film.genre}</small> 
=======
              <small>${film.genresLabels.at(0)}</small> 
>>>>>>> Feature/IHM
            </div>

            <button class="add-btn" onclick="ajouterAuxMoviesUsed(${index})">
              <img class="add-logo" src="add.svg" alt="Ajouter"/>
            </button>
          </div>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.innerHTML = "<p>Erreur lors de la récupération des données.</p>";
    console.error(error);
  }
}

window.ajouterAuxMoviesUsed = function (index) {
  if (savedMovies.length >= 5) {
    alert("Ta liste est complète ! Enlève un film pour en ajouter un nouveau.");
    return;
  }

  const movieToAdd = currentSearchResults[index];

  const existeDeja = savedMovies.some(
    (m) => m.title === movieToAdd.title && m.year === movieToAdd.year
  );
  if (existeDeja) {
    alert("Ce film est déjà dans ta liste !");
    return;
  }

  savedMovies.push(movieToAdd);
  sessionStorage.setItem("moviesUsed", JSON.stringify(savedMovies));
  updateSavedListUI();
};

window.supprimerFilm = function (index) {
  savedMovies.splice(index, 1);
  sessionStorage.setItem("moviesUsed", JSON.stringify(savedMovies));
  updateSavedListUI();
};

function updateSavedListUI() {
  const placeholders = document.querySelectorAll(".movie-placeholder");

  placeholders.forEach((p) => {
    p.classList.remove("filled");
    p.innerHTML = "";
  });

  savedMovies.forEach((film, index) => {
    if (index < placeholders.length) {
      const p = placeholders[index];
      p.classList.add("filled");
      p.innerHTML = `
        <div class="mini-card">
          ${film.image ? `<img src="${film.image}" alt="${film.title}"/>` : ""}
          <div class="mini-card-info">
            <span class="mini-title">${film.title}</span>
            <button class="remove-btn" onclick="supprimerFilm(${index})">×</button>
          </div>
        </div>
      `;
    }
  });
}


window.ouvrirDetails = function(index) {
    const film = currentSearchResults[index]
    sessionStorage.setItem('moviesClick', JSON.stringify(film))
    
    window.location.href = 'infos_film.html'
}