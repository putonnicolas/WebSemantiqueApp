// import { explainRecommendation } from "./llm.js";

const wikidataUrl = "https://query.wikidata.org/sparql";
console.log("Test");

// Récupération de l'ID depuis le Session Storage
let movieSelected = JSON.parse(sessionStorage.getItem("moviesClick")) || [];
if (movieSelected.length > 0) {
  sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
}

// Fonction pour afficher les détails dans les divs
async function displayFilmDetails(movieSelected) {
  const imageDiv = document.getElementById("imageFilm");
  const titleDiv = document.getElementById("titleFilm");
  const genreDiv = document.getElementById("genreFilm");
  const descriptionDiv = document.getElementById("descriptionFilm");
  const yearDiv = document.getElementById("yearFilm");
  const explicationIADiv = document.getElementById("explicationIA");

  // Affiche l'image
  if (movieSelected.image) {
    imageDiv.innerHTML = `<img src="${movieSelected.image}" alt="Affiche du film" style="max-width: 300px;">`;
  } else {
    imageDiv.innerHTML = "<p>Pas d'image disponible</p>";
  }

  // Affiche le titre
  titleDiv.innerHTML = `<h2>${movieSelected.title}</h2>`;

  // Affiche le genre
  if (movieSelected.genre) {
    genreDiv.innerHTML = `<p><strong>Genre :</strong> ${movieSelected.genre}</p>`;
  } else {
    genreDiv.innerHTML = "<p><strong>Genre :</strong> Non spécifié</p>";
  }

  // Affiche la description
  if (movieSelected.description) {
    descriptionDiv.innerHTML = `<p>${movieSelected.description}</p>`;
  } else {
    descriptionDiv.innerHTML = "<p>Description non disponible</p>";
  }

  // Affiche l'année de sortie
  if (movieSelected.year) {
    descriptionDiv.innerHTML = `<p>${movieSelected.year}</p>`;
  } else {
    descriptionDiv.innerHTML = "<p>Année de sortie non disponible</p>";
  }
  // Affiche l'année de sortie
  if (movieSelected.year) {
    yearDiv.innerHTML = `<p>Année de sortie : ${movieSelected.year}</p>`;
  } else {
    yearDiv.innerHTML = "<p>Année de sortie non disponible</p>";
  }

  // // Affiche l'explication IA
  // if (movieSelected.isRecommended) {
  //   try {
  //     let savedMovies = JSON.parse(sessionStorage.getItem("moviesUsed")) || [];
  //     const explanation = await explainRecommendation({
  //       filmsUtilisateur: savedMovies,
  //       filmRecommande: movieSelected,
  //       analyseRecommandation: {
  //         scoreTotal: 7,
  //         raisons: {
  //           realisateurCommun: {
  //             points: 0,
  //             details: [],
  //           },
  //           genresCommuns: {
  //             points: 0,
  //             details: [],
  //           },
  //           acteursCommuns: {
  //             points: 0,
  //             details: [],
  //           },
  //           anneeProche: {
  //             points: 1,
  //             ecart: 14,
  //           },
  //           paysCommun: {
  //             points: 0,
  //             details: [],
  //           },
  //           scenaristeCommun: {
  //             points: 0,
  //             details: [],
  //           },
  //           motsClesCommuns: {
  //             points: 0,
  //             details: [],
  //           },
  //           langueCommune: {
  //             points: 0,
  //             details: [],
  //           },
  //           dureeProche: {
  //             points: 1,
  //             ecart: 7,
  //           },
  //           prixRecompenses: {
  //             points: 3,
  //             details: "Les trois films ont été primés aux Oscars",
  //           },
  //           innovationVisuelle: {
  //             points: 2,
  //             details: "Style visuel distinctif et mémorable",
  //           },
  //         },
  //       },
  //     });
  //     explicationIADiv.innerHTML = `<p>${explanation}</p>`;
  //   } catch (error) {
  //     explicationIADiv.innerHTML = "<p>Explication non disponible</p>";
  //     console.error(
  //       "Erreur lors de la génération de l'explication IA :",
  //       error
  //     );
  //   }
  // }
}

displayFilmDetails(movieSelected)