import { explainRecommendation } from "./llm.js";
import { getTmdbSynopsis } from "./tmdb.js";

let movieSelected = JSON.parse(sessionStorage.getItem("moviesClick")) || [];
if (movieSelected.length > 0) {
  sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
}

async function displayFilmDetails(movieSelected) {
  const imageDiv = document.getElementById("imageFilm");
  const titleDiv = document.getElementById("titleFilm");
  const genreDiv = document.getElementById("genreFilm");
  const directorDiv = document.getElementById("director");
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

  const synopsisText =
    movieSelected.tmdbSynopsis ||
    (await getTmdbSynopsis(movieSelected.title, movieSelected.year));

  if (synopsisText) {
    movieSelected.tmdbSynopsis = synopsisText;
    sessionStorage.setItem("moviesClick", JSON.stringify(movieSelected));
    
    summaryFilm.insertAdjacentHTML('beforeend', `
      <div class='panelInfos' id="synopsisFilm">
        <p><strong>Synopsis</strong></p>
        <p>${synopsisText}</p>
      </div>
    `);
  }

  yearDiv.innerHTML = `<p>${movieSelected.year || ""}</p>`;

  if (movieSelected.isRecommended) {
    summaryFilm.insertAdjacentHTML('beforeend', `<div id="GraphAndAI"></div>`);
    
    const graphAndAI = document.getElementById("GraphAndAI");
    
    generateRelationshipGraph(movieSelected);

    graphAndAI.insertAdjacentHTML('beforeend', `
      <div class='panelInfos' id="IASummary">
          <div id='IADiv'>
              <p><strong>Explication recommandation</strong></p>
              <img src="ia_sparks.svg" alt="IA" class="ia-icon"/>    
          </div>
          <p id="streamingText" style="color: #ccc; line-height: 1.6;"></p>
      </div>`);

    const textContainer = document.getElementById("streamingText");
    
    if (!textContainer) return;

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
      console.error(error);
    }
  }
}

function generateRelationshipGraph(movieSelected) {
  if (!movieSelected.isRecommended) return;

  const html = `      
    <div class="panelInfos" id="graph">
      <div class="panel-title"><p><strong>Relations entre les films</strong></p></div>
      <div id="cy-loader"><div class="spinner"></div></div>
      <div id="cy-graph"></div>
      <div id="cy-legend">
        <div class="legend-item"><span class="dot main"></span> Recommandé</div>
        <div class="legend-item"><span class="dot past"></span> Vu par vous</div>
        <div class="legend-item"><span class="dot genre"></span> Genre</div>
        <div class="legend-item"><span class="dot director"></span> Réalisateur</div>
        <div class="legend-item"><span class="dot actor"></span> Acteur</div>
      </div>
    </div>`;

  const targetContainer = document.getElementById("GraphAndAI") || document.getElementById("summaryFilm");
  targetContainer.insertAdjacentHTML('beforeend', html);

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
      data: { id: movieSelected.directorId, label: movieSelected.directorName, type: "director" },
    });
    elements.push({ data: { source: movieSelected.id, target: movieSelected.directorId } });
  }

  movieSelected.genresLabels?.forEach((genre) => {
    const genreId = `genre-${genre}`;
    if (!elements.find((el) => el.data.id === genreId)) {
      elements.push({ data: { id: genreId, label: genre, type: "genre" } });
    }
    elements.push({ data: { source: movieSelected.id, target: genreId } });
  });

  savedMovies.forEach((pastMovie) => {
    const commonGenres = pastMovie.genresLabels?.filter((g) => movieSelected.genresLabels?.includes(g)) || [];
    const commonActors = pastMovie.actorsIds?.filter((id) => movieSelected.actorsIds?.includes(id)) || [];
    const sameDirector = pastMovie.directorId === movieSelected.directorId;

    if (sameDirector || commonGenres.length > 0 || commonActors.length > 0) {
      elements.push({
        data: { id: pastMovie.id, label: pastMovie.title, type: "past-movie", image: pastMovie.image },
      });

      if (sameDirector) elements.push({ data: { source: pastMovie.id, target: movieSelected.directorId } });
      
      commonGenres.forEach((genre) => elements.push({ data: { source: pastMovie.id, target: `genre-${genre}` } }));
      
      commonActors.slice(0, 2).forEach((actorId) => {
        if (!elements.find((el) => el.data.id === actorId)) {
          elements.push({ data: { id: actorId, label: "Acteur", type: "actor" } });
          elements.push({ data: { source: movieSelected.id, target: actorId } });
        }
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
      {
        selector: "edge",
        style: {
          width: 2,
          "line-color": "#666",
          "curve-style": "bezier",
          opacity: 0.5,
        },
      },
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