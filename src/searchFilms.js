import { SparqlClient } from "./SparqlClient.js"

const wikidataUrl = "https://query.wikidata.org/sparql"
const client = new SparqlClient(wikidataUrl)

export async function searchMoviesOnWikidata(term) {
  const query = `
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

  const rawData = await client.query(query)

  if (!rawData || rawData.length === 0) {
    return []
  }

  return rawData.map(data => ({
    id: data.item.value,
    title: data.itemLabel,
    image: data.image || "https://via.placeholder.com/300x450?text=Affiche+Manquante",
    year: data.date ? new Date(data.date).getFullYear() : "N/C",
    director: data.directorLabel || "Inconnu",
    genre: data.genreLabel || "Non classé"
  }))
}