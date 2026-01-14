import { SparqlClient } from './SparqlClient.js';

const wikidataUrl = "https://query.wikidata.org/sparql";
const client = new SparqlClient(wikidataUrl);

// Récupération de l'ID depuis le Session Storage 
let moviesSelected = JSON.parse(sessionStorage.getItem('moviesClick')) || [];
    if (moviesSelected.length > 0) {
        sessionStorage.setItem('moviesClick', JSON.stringify(moviesSelected));
    }

// Fonction pour afficher les détails dans les divs
function displayFilmDetails(moviesSelected) {
    const imageDiv = document.getElementById('imageFilm');
    const titleDiv = document.getElementById('titleFilm');
    const genreDiv = document.getElementById('genreFilm');
    const descriptionDiv = document.getElementById('descriptionFilm');
    const yearDiv = document.getElementById('yearFilm');
    const explicationIADiv = document.getElementById('explicationIA');

    // Affiche l'image
    if (moviesSelected.image) {
        imageDiv.innerHTML = `<img src="${moviesSelected.image}" alt="Affiche du film" style="max-width: 300px;">`;
    } else {
        imageDiv.innerHTML = '<p>Pas d\'image disponible</p>';
    }

    // Affiche le titre
    titleDiv.innerHTML = `<h2>${moviesSelected.title}</h2>`;

    // Affiche le genre
    if (moviesSelected.genre) {
        genreDiv.innerHTML = `<p><strong>Genre :</strong> ${moviesSelected.genre}</p>`;
    } else {
        genreDiv.innerHTML = '<p><strong>Genre :</strong> Non spécifié</p>';
    }

    // Affiche la description
    if (moviesSelected.description) {
        descriptionDiv.innerHTML = `<p>${moviesSelected.description}</p>`;
    } else {
        descriptionDiv.innerHTML = '<p>Description non disponible</p>';
    }

    // Affiche l'année de sortie
    if (moviesSelected.year) {
        descriptionDiv.innerHTML = `<p>${moviesSelected.year}</p>`;
    } else {
        descriptionDiv.innerHTML = '<p>Année de sortie non disponible</p>';
    }
    // Affiche l'année de sortie
    if (moviesSelected.year) {
        yearDiv.innerHTML = `<p>Année de sortie : ${moviesSelected.year}</p>`;
    } else {
        yearDiv.innerHTML = '<p>Année de sortie non disponible</p>';
    }
    // Affiche l'explication IA

}
