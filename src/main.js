import "../style.css";
import { searchMoviesOnWikidata, getMovieFullDetails } from "./searchFilms.js";

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
              
              <small>${film.genresLabels.at(0)}</small> 
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

window.ajouterAuxMoviesUsed = async function (index) {
  if (savedMovies.length >= 5) {
    alert("Ta liste est complète ! Enlève un film pour en ajouter un nouveau.");
    return;
  }

  const movieBasic = currentSearchResults[index];

  const existeDeja = savedMovies.some(
    (m) => m.title === movieBasic.title && m.year === movieBasic.year
  );
  if (existeDeja) {
    alert("Ce film est déjà dans ta liste !");
    return;
  }

  // Show loading state in the next available slot
  const nextSlot = savedMovies.length;
  showLoadingState(nextSlot);

  // Fetch full details before adding
  try {
    const movieFull = await getMovieFullDetails(movieBasic.id);
    
    if (movieFull) {
      // Keep the poster from the basic search result
      movieFull.image = movieBasic.image;
      savedMovies.push(movieFull);
    } else {
      // Fallback: use basic data if full details fail
      savedMovies.push({
        ...movieBasic,
        genres: [],
        cast: [],
        screenwriterIds: [],
        countryIds: [],
        languageIds: [],
        mainSubjectIds: []
      });
    }
    
    sessionStorage.setItem("moviesUsed", JSON.stringify(savedMovies));
    updateSavedListUI();
  } catch (error) {
    console.error("Error fetching full movie details:", error);
    // Clear loading state on error
    clearLoadingState(nextSlot);
    alert("Erreur lors de l'ajout du film. Veuillez réessayer.");
  }
};

window.supprimerFilm = function (index) {
  savedMovies.splice(index, 1);
  sessionStorage.setItem("moviesUsed", JSON.stringify(savedMovies));
  updateSavedListUI();
};

function showLoadingState(slotIndex) {
  const placeholders = document.querySelectorAll(".movie-placeholder");
  if (slotIndex < placeholders.length) {
    placeholders[slotIndex].classList.add("loading");
  }
}

function clearLoadingState(slotIndex) {
  const placeholders = document.querySelectorAll(".movie-placeholder");
  if (slotIndex < placeholders.length) {
    placeholders[slotIndex].classList.remove("loading");
  }
}

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