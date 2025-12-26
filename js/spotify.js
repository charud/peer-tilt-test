// Spotify API Helper with PKCE OAuth Flow

class SpotifyAuth {
  constructor(config = {}) {
    this.clientId = config.clientId || '7d46e1a144ee4f3fac2984db7a62fb35';
    this.redirectUri = config.redirectUri || this.detectRedirectUri();
    this.scopes = ''; // No special scopes needed for public endpoints

    this.accessToken = localStorage.getItem('spotify_access_token');
    this.refreshToken = localStorage.getItem('spotify_refresh_token');
    this.tokenExpiry = parseInt(localStorage.getItem('spotify_token_expiry') || '0');
  }

  detectRedirectUri() {
    // Use current URL without hash/query params
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  // Generate random string for PKCE
  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  // Generate code verifier and challenge for PKCE
  async generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  // Check if logged in with valid token
  isLoggedIn() {
    return this.accessToken && Date.now() < this.tokenExpiry;
  }

  // Start OAuth login flow
  async login() {
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateRandomString(16);

    // Store verifier for callback
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
      scope: this.scopes
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  // Handle OAuth callback - call this on page load
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    // Check URL first, then sessionStorage (in case URL was stripped)
    let code = params.get('code') || sessionStorage.getItem('spotify_oauth_code');
    let state = params.get('state') || sessionStorage.getItem('spotify_oauth_state');
    const error = params.get('error');

    // Clear sessionStorage after reading
    sessionStorage.removeItem('spotify_oauth_code');
    sessionStorage.removeItem('spotify_oauth_state');

    console.log('Spotify handleCallback - code:', code ? 'present' : 'none', 'state:', state, 'error:', error);

    if (error) {
      console.error('Spotify auth error:', error);
      return false;
    }

    if (!code) {
      console.log('No code in URL, skipping callback');
      return false; // No callback to handle
    }

    // Verify state
    const storedState = localStorage.getItem('spotify_auth_state');
    console.log('State check - received:', state, 'stored:', storedState);
    if (state !== storedState) {
      console.error('State mismatch');
      return false;
    }

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    console.log('Code verifier:', codeVerifier ? 'present' : 'missing');
    if (!codeVerifier) {
      console.error('No code verifier found');
      return false;
    }

    // Exchange code for token
    try {
      console.log('Exchanging code for token, redirect_uri:', this.redirectUri);
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      console.log('Token response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange failed:', errorData);
        return false;
      }

      const data = await response.json();
      console.log('Token received, saving...');
      this.saveTokens(data);

      // Clean up URL
      window.history.replaceState({}, document.title, this.redirectUri);

      // Clean up stored verifier
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_auth_state');

      return true;
    } catch (e) {
      console.error('Token exchange error:', e);
      return false;
    }
  }

  // Save tokens to localStorage
  saveTokens(data) {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    localStorage.setItem('spotify_access_token', this.accessToken);
    if (this.refreshToken) {
      localStorage.setItem('spotify_refresh_token', this.refreshToken);
    }
    localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.saveTokens(data);
      return true;
    } catch (e) {
      console.error('Token refresh error:', e);
      return false;
    }
  }

  // Ensure we have a valid token
  async ensureToken() {
    if (this.isLoggedIn()) {
      return true;
    }

    // Try to refresh
    if (this.refreshToken) {
      return await this.refreshAccessToken();
    }

    return false;
  }

  // Logout
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
  }

  // Make authenticated API request
  async apiRequest(endpoint, options = {}) {
    if (!await this.ensureToken()) {
      throw new Error('Not authenticated');
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.spotify.com/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try refresh
      if (await this.refreshAccessToken()) {
        return this.apiRequest(endpoint, options);
      }
      throw new Error('Authentication expired');
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Search for tracks by keyword/genre
  async searchTracks(query, limit = 50) {
    // Search for popular tracks matching the genre/query
    const data = await this.apiRequest(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
    );

    // Filter to only tracks with preview URLs
    const tracksWithPreviews = data.tracks.items.filter(track => track.preview_url);

    return tracksWithPreviews.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0]?.name || 'Unknown Artist',
      album: track.album.name,
      previewUrl: track.preview_url,
      albumArt: track.album.images[0]?.url,
      displayName: `${track.artists[0]?.name} - ${track.name}`
    }));
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpotifyAuth;
}
