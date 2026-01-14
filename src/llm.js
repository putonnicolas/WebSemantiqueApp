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



async function explainRecommendation(data) {
    const systemPrompt = `Tu es un critique de cinéma expert qui explique pourquoi un film est recommandé à un utilisateur. 
Tu dois analyser les similarités entre les films que l'utilisateur a aimés et le film recommandé, 
et rédiger plusieurs paragraphes courts, convaincants et personnalisés en français (100-150 mots au total).

Mets l'accent sur :
- Les points communs artistiques (réalisateur, acteurs, genres)
- Les thématiques communes
- Le style ou l'ambiance similaire
- Ce que l'utilisateur pourrait apprécier spécifiquement

Généralement, un excellent score recommandation est aux alentours de 600 points.
On utilise la grille de notation suivante :
- Genre en commun : +10
- Réalisateur en commun : +5
- Acteur : +3
- +- 5 ans de différence : +1
- Pays: +2
- Scénariste : +5.

Ne mentionne pas le calcul du score dans ton explication, mais prends le score total en compte pour justifier la recommandation.
Si le score est bas, c'est que le film recommandé a peu de points communs avec les films aimés par l'utilisateur.
Evite alors de mentir ou d'inventer des similarités qui n'existent pas, et concentre-toi sur l'ouverture à de nouveaux styles ou genres que l'utilisateur pourrait apprécier.

Sois enthousiaste mais précis. Évite les formules génériques. Commence directement par l'explication sans introduction.`;

    const userPrompt = `Films aimés par l'utilisateur :
${JSON.stringify(data.filmsUtilisateur, null, 2)}

Film recommandé :
${JSON.stringify(data.filmRecommande, null, 2)}

Analyse de la recommandation :
${JSON.stringify(data.analyseRecommandation, null, 2)}

Rédige plusieurs paragraphes courts expliquant pourquoi ce film est recommandé.`;

    const response = await client.chat.completions.create({
        model: "llama3:70b",
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: userPrompt,
            },
        ],
        temperature: 0.7,
    });

    return response.choices[0].message.content;
}

// ============================================
// DONNÉES DE TEST - Films très différents
// ============================================
const testData = {
    filmsUtilisateur: [
        {
            id: "Q47075",
            titre: "Le Fabuleux Destin d'Amélie Poulain",
            titreOriginal: "Le Fabuleux Destin d'Amélie Poulain",
            annee: 2001,
            duree: 122,
            realisateurs: ["Jean-Pierre Jeunet"],
            scenaristes: ["Guillaume Laurant", "Jean-Pierre Jeunet"],
            acteurs: ["Audrey Tautou", "Mathieu Kassovitz", "Jamel Debbouze"],
            genres: ["Comédie romantique", "Comédie"],
            motsCles: ["Paris", "solitude", "imagination", "amour"],
            langue: "Français",
            pays: ["France", "Allemagne"],
            prix: ["César de la meilleure photographie"],
            saga: null
        },
        {
            id: "Q193563",
            titre: "Parasite",
            titreOriginal: "기생충",
            annee: 2019,
            duree: 132,
            realisateurs: ["Bong Joon-ho"],
            scenaristes: ["Bong Joon-ho", "Han Jin-won"],
            acteurs: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"],
            genres: ["Thriller", "Drame", "Comédie noire"],
            motsCles: ["inégalités sociales", "famille", "manipulation", "pauvreté"],
            langue: "Coréen",
            pays: ["Corée du Sud"],
            prix: ["Oscar du meilleur film", "Palme d'Or"],
            saga: null
        }
    ],
    filmRecommande: {
        id: "Q190050",
        titre: "Mad Max: Fury Road",
        titreOriginal: "Mad Max: Fury Road",
        annee: 2015,
        duree: 120,
        realisateurs: ["George Miller"],
        scenaristes: ["George Miller", "Brendan McCarthy", "Nick Lathouris"],
        acteurs: ["Tom Hardy", "Charlize Theron", "Nicholas Hoult"],
        genres: ["Action", "Science-Fiction", "Aventure"],
        motsCles: ["désert", "post-apocalypse", "survie", "rebellion"],
        langue: "Anglais",
        pays: ["Australie", "États-Unis"],
        prix: ["Oscar du meilleur montage", "Oscar des meilleurs effets visuels"],
        saga: "Mad Max"
    },
    analyseRecommandation: {
        scoreTotal: 7,
        raisons: {
            realisateurCommun: {
                points: 0,
                details: []
            },
            genresCommuns: {
                points: 0,
                details: []
            },
            acteursCommuns: {
                points: 0,
                details: []
            },
            anneeProche: {
                points: 1,
                ecart: 14
            },
            paysCommun: {
                points: 0,
                details: []
            },
            scenaristeCommun: {
                points: 0,
                details: []
            },
            motsClesCommuns: {
                points: 0,
                details: []
            },
            langueCommune: {
                points: 0,
                details: []
            },
            dureeProche: {
                points: 1,
                ecart: 7
            },
            prixRecompenses: {
                points: 3,
                details: "Les trois films ont été primés aux Oscars"
            },
            innovationVisuelle: {
                points: 2,
                details: "Style visuel distinctif et mémorable"
            }
        }
    }
};

// ============================================
// TEST : Décommentez la ligne suivante pour tester
// ============================================
// explainRecommendation(testData)
//     .then(explanation => {
//         console.log("\n=== EXPLICATION GÉNÉRÉE PAR LE LLM ===\n");
//         console.log(explanation);
//         console.log("\n=====================================\n");
//     })
//     .catch(console.error);

// Export pour utilisation dans d'autres modules
export { explainRecommendation };