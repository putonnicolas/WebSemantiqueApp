import { explainRecommendation } from "./llm.js";
import { getTmdbSynopsis } from "./tmdb.js";
import { updateSavedListUI } from "./main.js";

document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI();
});
let movieSelected = JSON.parse(sessionStorage.getItem("moviesClick")) || [];
if (movieSelected.length > 0) {
  sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
}

async function displayFilmDetails(movieSelected) {
  const imageDiv = document.getElementById("imageFilm");
  const titleDiv = document.getElementById("titleFilm");
  const genreDiv = document.getElementById("genreFilm");
  const directorDiv = document.getElementById("director");
  const synopsisDiv = document.getElementById("synopsisFilm");
  const yearDiv = document.getElementById("yearFilm");
  const summaryFilm = document.getElementById("summaryFilm");

  if (imageDiv && movieSelected.image) {
    imageDiv.innerHTML = `<img src="${movieSelected.image}" alt="${movieSelected.title}"/>`;
  }

  titleDiv.innerHTML = `<p>${movieSelected.title}</p>`;
  directorDiv.innerHTML = `<p><strong>Réalisateur :</strong> ${movieSelected.directorName}</p>`;

  if (movieSelected.genresLabels && movieSelected.genresLabels.length > 0) {
    let htmlGenre = "<p><strong>Genres :</strong>";
    movieSelected.genresLabels.slice(0, 5).forEach((e) => {
      htmlGenre += `<div class='genre-bubble'>${e}</div>`;
    });
    htmlGenre += "</p>";
    genreDiv.innerHTML = htmlGenre;
  }

  const renderSynopsis = (text) => {
    synopsisDiv.innerHTML = `
      <p style="color: #ccc; line-height: 1.6; margin-top: 15px; font-size: 14px;">${text}</p>
    `;
  };

  if (movieSelected.tmdbSynopsis) {
    renderSynopsis(movieSelected.tmdbSynopsis);
  } else if (movieSelected.description) {
    renderSynopsis(movieSelected.description);
  } else {
    synopsisDiv.innerHTML = `
      <p style="color: #999; line-height: 1.6; margin-top: 15px; font-size: 14px;"><em>Chargement du synopsis...</em></p>
    `;
  }

  const synopsisText =
    movieSelected.tmdbSynopsis ||
    (await getTmdbSynopsis(movieSelected.title, movieSelected.year));

  if (synopsisText) {
    movieSelected.tmdbSynopsis = synopsisText;
    sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
    renderSynopsis(synopsisText);
  } else if (movieSelected.description) {
    renderSynopsis(movieSelected.description);
  } else {
    synopsisDiv.innerHTML = `
      <p style="color: #999; line-height: 1.6; margin-top: 15px; font-size: 14px;">Aucun synopsis disponible.</p>
    `;
  }

  yearDiv.innerHTML = `<p>${movieSelected.year || ""}</p>`;

  if (movieSelected.isRecommended) {
    summaryFilm.innerHTML += `
      <div class='panelInfos' id="IASummary">
          <div id='IADiv'>
              <p><strong>Explication recommandation</strong></p>
              <img src="ia_sparks.svg" alt="IA" class="ia-icon"/>    
          </div>
          <p id="streamingText" style="color: #ccc; line-height: 1.6;"></p>
      </div>`;

    generateRelationshipGraph(movieSelected);

    const textContainer = document.getElementById("streamingText");
    if (movieSelected.cachedExplanation) {
      textContainer.innerText = movieSelected.cachedExplanation;
      return;
    }

    try {
      textContainer.innerHTML = "<em>L'IA analyse votre profil...</em>";
      let savedMovies = JSON.parse(sessionStorage.getItem("moviesUsed")) || [];
      const stream = await explainRecommendation({
        filmsUtilisateur: savedMovies,
        filmRecommande: movieSelected,
        analyseRecommandation: {
          scoreTotal: movieSelected.recommendation.score,
          raisons: movieSelected.recommendation.reasons,
        },
      });

      let fullText = "";
      textContainer.innerText = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;
        textContainer.innerText = fullText;
      }
      movieSelected.cachedExplanation = fullText;
      sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
    } catch (error) {
      textContainer.innerText = "Erreur de génération.";
    }
  }
}

function generateRelationshipGraph(movieSelected) {
  const container = document.getElementById("cy-graph");
  const loader = document.getElementById("cy-loader");
  if (!container) return;

  const savedMovies = JSON.parse(sessionStorage.getItem("moviesUsed")) || [];
  let elements = [];

  elements.push({
    data: {
      id: movieSelected.id,
      label: movieSelected.title,
      type: "main-movie",
      image: movieSelected.image,
    },
  });

  if (movieSelected.directorId) {
    elements.push({
      data: {
        id: movieSelected.directorId,
        label: movieSelected.directorName,
        type: "director",
      },
    });
    elements.push({
      data: { source: movieSelected.id, target: movieSelected.directorId },
    });
  }

  movieSelected.genresLabels?.forEach((genre) => {
    const genreId = `genre-${genre}`;
    if (!elements.find((el) => el.data.id === genreId)) {
      elements.push({ data: { id: genreId, label: genre, type: "genre" } });
    }
    elements.push({ data: { source: movieSelected.id, target: genreId } });
  });

  // Étape 1 : Créer les 5 premiers acteurs du film recommandé
  const actorIds = movieSelected.actorsIds || [];
  const actorNames = movieSelected.actorsNames || [];
  const createdActorIds = new Set();
  
  actorIds.slice(0, 5).forEach((actorId, index) => {
    if (!elements.find(el => el.data.id === actorId)) {
      const actorName = actorNames[index] || "Acteur";
      elements.push({ data: { id: actorId, label: actorName, type: "actor" } });
      createdActorIds.add(actorId);
    }
    elements.push({ data: { source: movieSelected.id, target: actorId } });
  });

  // Étape 2 : Trouver les acteurs communs avec les films passés
  const commonActorsToAdd = new Set();
  savedMovies.forEach((pastMovie) => {
    const pastActorIds = pastMovie.actorsIds || pastMovie.cast || [];
    const currentActorIds = movieSelected.actorsIds || [];
    pastActorIds.forEach((actorId) => {
      if (currentActorIds.includes(actorId) && !createdActorIds.has(actorId)) {
        commonActorsToAdd.add(actorId);
      }
    });
  });

  // Étape 3 : Créer les nœuds pour les acteurs communs
  commonActorsToAdd.forEach((actorId) => {
    const index = actorIds.indexOf(actorId);
    const actorName = index >= 0 ? actorNames[index] : "Acteur";
    elements.push({ data: { id: actorId, label: actorName, type: "actor" } });
    elements.push({ data: { source: movieSelected.id, target: actorId } });
    createdActorIds.add(actorId);
  });

  // Étape 4 : Créer les films passés et leurs connexions
  savedMovies.forEach((pastMovie) => {
    const commonGenres = pastMovie.genresLabels?.filter((g) => movieSelected.genresLabels?.includes(g)) || [];

    const pastActorIds = pastMovie.actorsIds || pastMovie.cast || [];
    const commonActors = pastActorIds.filter((id) => createdActorIds.has(id));
    const sameDirector = pastMovie.directorId === movieSelected.directorId;

    if (sameDirector || commonGenres.length > 0 || commonActors.length > 0) {
      elements.push({
        data: {
          id: pastMovie.id,
          label: pastMovie.title,
          type: "past-movie",
          image: pastMovie.image,
        },
      });

      if (sameDirector) elements.push({ data: { source: pastMovie.id, target: movieSelected.directorId } });
      commonGenres.forEach((genre) => elements.push({ data: { source: pastMovie.id, target: `genre-${genre}` } }));
      
      // Relier les films passés aux acteurs communs
      commonActors.forEach((actorId) => {
        elements.push({ data: { source: pastMovie.id, target: actorId } });
      });
    }
  });

  const cy = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-valign": "bottom",
          "text-margin-y": 8,
          color: "#fff",
          "font-size": "10px",
          "background-color": "#444",
          width: "40px",
          height: "40px",
          "background-fit": "cover",
          "border-width": 2,
          "border-color": "#555",
        },
      },
      { selector: "node[image]", style: { "background-image": "data(image)" } },
      { selector: 'node[type="main-movie"]', style: { width: "65px", height: "65px", "border-color": "#e74c3c", "border-width": 4 } },
      { selector: 'node[type="past-movie"]', style: { "border-color": "#3498db", "border-width": 3 } },
      { selector: 'node[type="genre"]', style: { "background-color": "#2ecc71", shape: "diamond" } },
      { selector: 'node[type="director"]', style: { "background-color": "#f1c40f", shape: "rectangle" } },
      { selector: 'node[type="actor"]', style: { "background-color": "#e67e22", shape: "ellipse" } },
      { selector: "edge", style: { width: 2, "line-color": "#666", "curve-style": "bezier", opacity: 0.5 } }
    ],
    layout: { name: "cose", padding: 50, animate: true },
  });

  cy.ready(() => {
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = "0";
        setTimeout(() => {
          loader.style.display = "none";
        }, 500);
      }, 500);
    }
  });
}

displayFilmDetails(movieSelected);
