import OpenAI from "openai";

const client = new OpenAI({
    baseURL: "https://ollama-ui.pagoda.liris.cnrs.fr/api",
    apiKey: "sk-c7fe7d4c590b4929961ac12579088048",
    dangerouslyAllowBrowser: true
});


async function explainRecommendation(data) {
    const systemPrompt = `Tu es un critique de cinéma expert qui explique pourquoi un film est recommandé à un utilisateur. 
Tu dois analyser les similarités entre les films que l'utilisateur a aimés et le film recommandé, 
et rédiger plusieurs paragraphes courts, convaincants et personnalisés en français (100-150 mots au total).

Mets l'accent sur :
- Les points communs artistiques (réalisateur, acteurs, genres)
- Les thématiques communes
- Le style ou l'ambiance similaire
- Ce que l'utilisateur pourrait apprécier spécifiquement
- N'hésite pas à te baser sur le(s) synopsis pour trouver des similarités de thèmes ou d'intrigues, ou donner envie de découvrir le film.

Généralement, un excellent score recommandation est aux alentours de 150 points ou +.
On utilise la grille de notation suivante :
    GENRE: 10,
    DIRECTOR: 10,
    SCREENWRITER: 10,
    CAST: 15,
    MAIN_SUBJECT: 12,

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

Rédige plusieurs paragraphes courts expliquant pourquoi ce film est recommandé. NE DEPASSE PAS LES 800 CARACTERES.`;
    console.log("Envoie de la requete IA");
    
const stream = await client.chat.completions.create({
        model: "llama3:70b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        stream: true, 
    });

    return stream; 
}

export { explainRecommendation };