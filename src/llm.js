import OpenAI from "openai";

const client = new OpenAI({
    baseURL: "https://ollama-ui.pagoda.liris.cnrs.fr/api",
    apiKey: "sk-c7fe7d4c590b4929961ac12579088048",
});

async function translateToSparql() {
    const response = await client.chat.completions.create({
        model: "llama3:70b",
        messages: [
            {
                role: "system",
                content: "Tu es un traducteur de requêtes plein texte vers SPARQL. Tu utilises principalement DBPEDIA. Tu connais des éléments de modèle suivant : <http://dbpedia.org/resource/Comedy>. Tu ne dois répondre qu'en SPARQL, aucun texte, aucune explication en sus.",
            },
            {
                role: "user",
                content: "Quels sont les films de genre Drama ?",
            },
        ],
        temperature: 0.7,
    });

    console.log(response.choices[0].message.content);
}