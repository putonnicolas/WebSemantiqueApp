export class SparqlClient {
    constructor(endpointUrl) {
        this.endpointUrl = endpointUrl;
    }

    async query(sparqlQuery) {
        const fullUrl = this.endpointUrl + '?query=' + encodeURIComponent(sparqlQuery);
        const headers = { 'Accept': 'application/sparql-results+json' };

        try {
            const response = await fetch(fullUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            return this._simplifyResults(data);
            
        } catch (error) {
            console.error("Erreur SPARQL :", error);
            return [];
        }
    }

    _simplifyResults(data) {
        return data.results.bindings.map(binding => {
            const simplifiedObj = {};
            for (const key in binding) {
                simplifiedObj[key] = binding[key].value;
            }
            return simplifiedObj;
        });
    }
}