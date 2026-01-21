// TMDB API Configuration
const TMDB_API_KEY = "e8449bc9bb313cdcc4d5f1326446a971";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

/**
 * Search for a movie on TMDB and return the poster URL
 * @param {string} title - Movie title
 * @param {number} year - Movie release year (optional)
 * @returns {Promise<string|null>} - Poster URL or null if not found
 */
export async function getTmdbPoster(title, year = null) {
  try {
    // Force French metadata so we pick the localized title/poster variant when available
    let query = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(title)}`;
    
    // Add year filter if provided
    if (year) {
      query += `&year=${year}`;
    }

    const response = await fetch(query);
    
    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Return the poster of the first result if available
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      if (movie.poster_path) {
        return `${TMDB_POSTER_BASE_URL}${movie.poster_path}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching TMDB poster:", error);
    return null;
  }
}

/**
 * Get full movie details from TMDB
 * @param {number} tmdbId - TMDB movie ID
 * @returns {Promise<Object|null>} - Full movie details or null if not found
 */
export async function getTmdbMovieDetails(tmdbId) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`
    );

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching TMDB movie details:", error);
    return null;
  }
}

/**
 * Get a localized synopsis (overview) from TMDB search results
 * @param {string} title - Movie title
 * @param {number|null} year - Movie release year
 * @returns {Promise<string|null>} - Synopsis text or null if not found
 */
export async function getTmdbSynopsis(title, year = null) {
  try {
    let query = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(title)}`;
    if (year) {
      query += `&year=${year}`;
    }

    const response = await fetch(query);
    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const movie = data?.results?.[0];
    if (movie && movie.overview) {
      return movie.overview;
    }

    return null;
  } catch (error) {
    console.error("Error fetching TMDB synopsis:", error);
    return null;
  }
}

/**
 * Get or create poster with fallback strategy
 * @param {string} title - Movie title
 * @param {number} year - Movie release year
 * @param {string|null} wikidataImage - Wikidata image URL (fallback)
 * @returns {Promise<string|null>} - Final poster URL
 */
export async function getPosterWithFallback(title, year, wikidataImage = null) {
  // Try TMDB first
  const tmdbPoster = await getTmdbPoster(title, year);
  if (tmdbPoster) {
    return tmdbPoster;
  }

  // Fallback to Wikidata if TMDB fails
  if (wikidataImage) {
    return wikidataImage;
  }

  // If both fail, return null
  return null;
}
