// Les constantes SELECTED_MOVIES et WEIGHTS sont définis dans recommendations.js
// La fonction fetchRecommendations() vient aussi de recommendations.js

let cy; // Instance Cytoscape globale

const SELECTED_MOVIES = [
  {
    id: "Q25150",
    title: "Inception",
    year: 2010,
    directorId: "Q212730",
    screenwriterId: "Q212730",
    genres: ["Q187439", "Q170584"],
    cast: ["Q38111", "Q188573"],
    countryId: "Q30",
    languageId: "Q1860",
  },
  {
    id: "Q104123",
    title: "Pulp Fiction",
    year: 1994,
    directorId: "Q3772",
    screenwriterId: "Q3772",
    genres: ["Q124422", "Q130232"],
    cast: ["Q125217", "Q172678"],
    countryId: "Q30",
    languageId: "Q1860",
  },
  {
    id: "Q13551501",
    title: "Parasite",
    year: 2019,
    directorId: "Q499876",
    screenwriterId: "Q499876",
    genres: ["Q130232", "Q170584", "Q132821"],
    cast: ["Q495284", "Q484822"],
    countryId: "Q884",
    languageId: "Q9176",
  },
];

async function generateGraph() {
  const loadingMsg = document.getElementById("loadingMsg");
  loadingMsg.style.display = "block";
  loadingMsg.innerHTML = "Chargement des recommandations...";

  try {
    // Recommandations en dur pour tester le graphe
    const recommendations = [
      { id: "film1", title: "Inception", year: 2010, recommendation: { score: 0.95 } },
      { id: "film2", title: "Interstellar", year: 2014, recommendation: { score: 0.88 } },
      { id: "film3", title: "The Dark Knight", year: 2008, recommendation: { score: 0.85 } },
      { id: "film4", title: "Pulp Fiction", year: 1994, recommendation: { score: 0.78 } },
      { id: "film5", title: "Matrix", year: 1999, recommendation: { score: 0.82 } },
      { id: "film6", title: "Parasite", year: 2019, recommendation: { score: 0.75 } },
    ];
    
    if (!recommendations || recommendations.length === 0) {
      loadingMsg.innerHTML = "Aucune recommandation trouvée.";
      return;
    }

    // Construire les éléments pour Cytoscape
    const elements = buildGraphElements(recommendations);
    
    // Initialiser ou réinitialiser Cytoscape
    initializeCytoscape(elements);
    
    loadingMsg.style.display = "none";
  } catch (error) {
    console.error("Erreur lors de la génération du graphe:", error);
    loadingMsg.innerHTML = "Erreur lors du chargement. Réessayez.";
  }
}

function buildGraphElements(recommendations) {
  const elements = [];

  // Ajouter un nœud unique pour tous les films choisis
  const selectedMovieTitles = SELECTED_MOVIES.map(m => m.title).join("\n");
  elements.push({
    data: {
      id: "selected-node",
      label: `${selectedMovieTitles}`,
      type: "selected",
    },
  });

  // Ajouter les nœuds des films recommandés
  recommendations.forEach((movie) => {
    elements.push({
      data: {
        id: movie.id,
        label: `${movie.title}\n(${movie.year})`,
        type: "recommended",
      },
    });
  });

  // Ajouter les arêtes avec les scores
  recommendations.forEach((rec) => {
    // Créer une seule arête du nœud sélectionné vers le film recommandé
    elements.push({
      data: {
        id: `edge-selected-${rec.id}`,
        source: "selected-node",
        target: rec.id,
        label: rec.recommendation.score.toString(),
        score: rec.recommendation.score,
      },
    });
  });

  return elements;
}

function initializeCytoscape(elements) {
  const container = document.getElementById("cy");

  if (cy) {
    cy.destroy();
  }

  cy = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: "node",
        style: {
          content: "data(label)",
          "text-valign": "center",
          "text-halign": "center",
          "background-color": "#4a90e2",
          color: "#000",
          "font-size": 12,
          "text-wrap": "wrap",
          width: 120,
          height: 100
        },
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": 12,
          "text-background-color": "#fff",
          "text-background-opacity": 0.8,
          "line-color": "#ccc",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "#ccc",
          width: 2
        },
      },
    ],
    layout: {
      name: "cose",
      animate: true,
    },
  });

  // Interaction au clic sur les nœuds
  cy.on("tap", "node", function (evt) {
    const node = evt.target;
    const data = node.data();
    const type = data.type === "selected" ? "SÉLECTIONNÉ" : "RECOMMANDÉ";
    alert(`[${type}] ${data.label}`);
  });

  // Interaction au clic sur les arêtes
  cy.on("tap", "edge", function (evt) {
    const edge = evt.target;
    const score = edge.data("score");
    alert(`Score de similarité: ${score}`);
  });
}


// Générer le graphe au chargement de la page
document.addEventListener("DOMContentLoaded", generateGraph);
