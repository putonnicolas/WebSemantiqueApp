import "../style.css"
import { SparqlClient } from "./SparqlClient.js"

const wikidataUrl = "https://query.wikidata.org/sparql"
const client = new SparqlClient(wikidataUrl)

let currentSearchResults = []
let savedMovies = JSON.parse(sessionStorage.getItem('moviesUsed')) || []

document.addEventListener("DOMContentLoaded", () => {
  updateSavedListUI()
  
  document.querySelector("#searchBtn").addEventListener("click", lancerRecherche)
  document.querySelector("#movieSearch").addEventListener("keypress", (e) => {
    if (e.key === 'Enter') lancerRecherche()
  })
})

async function lancerRecherche() {
  const searchInput = document.querySelector("#movieSearch")
  const resultsDiv = document.querySelector("#results")
  const term = searchInput.value.trim()

  if (!term) return

  resultsDiv.innerHTML = '<div class="loader">Recherche en cours...</div>'

  const maRequete = `
    SELECT DISTINCT ?item ?itemLabel ?date ?image ?directorLabel ?genreLabel WHERE {
      ?item wdt:P31 wd:Q11424 .
      ?item rdfs:label ?itemLabel .
      FILTER (lang(?itemLabel) = "fr")
      FILTER (regex(?itemLabel, "${term}", "i"))
      
      OPTIONAL { ?item wdt:P577 ?date . }
      OPTIONAL { ?item wdt:P18 ?image . }
      
      OPTIONAL { 
        ?item wdt:P57 ?director . 
        ?director rdfs:label ?directorLabel . 
        FILTER(lang(?directorLabel) = "fr") 
      }
      OPTIONAL { 
        ?item wdt:P136 ?genre . 
        ?genre rdfs:label ?genreLabel . 
        FILTER(lang(?genreLabel) = "fr") 
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
    }
    LIMIT 20
  `

  try {
    const rawData = await client.query(maRequete)

    if (!rawData || rawData.length === 0) {
      resultsDiv.innerHTML = "<p>Aucun résultat trouvé pour cette recherche.</p>"
      return
    }

    currentSearchResults = rawData.map(data => ({
      title: data.itemLabel,
      image: data.image || null,
      year: data.date ? new Date(data.date).getFullYear() : "N/C",
      director: data.directorLabel || "Inconnu",
      genre: data.genreLabel || "Non classé",
      id: data.item.value
    }))

    let html = ""
    
    currentSearchResults.forEach((film, index) => {
      html += `
        <div class="film-card">
          <img src="${film.image}" alt="${film.title}" />
          <div class="film-info-overlay">
            <div class="info-text">
              <h3>${film.title}</h3>
              <p>${film.director} - ${film.year}</p>
              <small>${film.genre}</small>
            </div>
            <button 
              class="add-btn" 
              onclick="ajouterAuxMoviesUsed(${index})"
            >
              <img class="add-logo" src="add.svg" alt="Ajouter"/>
            </button>
          </div>
        </div>
      `
    })

    resultsDiv.innerHTML = html

  } catch (error) {
    resultsDiv.innerHTML = "<p>Erreur lors de la récupération des données.</p>"
    console.error(error)
  }
}

window.ajouterAuxMoviesUsed = function(index) {
  if (savedMovies.length >= 5) {
    alert("Ta liste est complète ! Enlève un film pour en ajouter un nouveau.")
    return
  }

  const movieToAdd = currentSearchResults[index]

  const existeDeja = savedMovies.some(m => m.title === movieToAdd.title && m.year === movieToAdd.year)
  if (existeDeja) {
    alert("Ce film est déjà dans ta liste !")
    return
  }

  savedMovies.push(movieToAdd)
  sessionStorage.setItem('moviesUsed', JSON.stringify(savedMovies))
  updateSavedListUI()
}

window.supprimerFilm = function(index) {
  savedMovies.splice(index, 1)
  sessionStorage.setItem('moviesUsed', JSON.stringify(savedMovies))
  updateSavedListUI()
}

function updateSavedListUI() {
  const placeholders = document.querySelectorAll('.movie-placeholder')

  placeholders.forEach(p => {
    p.classList.remove('filled')
    p.innerHTML = ""
  })

  savedMovies.forEach((film, index) => {
    if (index < placeholders.length) {
      const p = placeholders[index]
      p.classList.add('filled')
      p.innerHTML = `
        <div class="mini-card">
          <img src="${film.image}" alt="${film.title}">
          <div class="mini-card-info">
            <span class="mini-title">${film.title}</span>
            <button class="remove-btn" onclick="supprimerFilm(${index})">×</button>
          </div>
        </div>
      `
    }
  })
}