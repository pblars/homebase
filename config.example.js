// config.example.js
// -----------------------------------------------------------------------------
// COPY this file to `config.js` and fill in your real values.
// `config.js` is gitignored and must NEVER be committed.
//
// This file is loaded via a plain <script src="config.js"> tag in index.html
// BEFORE any other script, so `CONFIG` is available as a global everywhere.
// -----------------------------------------------------------------------------

const CONFIG = {
  // OpenWeatherMap — free tier key. https://openweathermap.org/api
  OPENWEATHERMAP_API_KEY: 'your_key_here',

  // Google Calendar — calendar id (often an email-like string) + API key
  GOOGLE_CALENDAR_ID: 'your_calendar_id',
  GOOGLE_API_KEY: 'your_key_here',

  // Location — Franklin, TN (zip 37064)
  LAT: 35.9251,
  LON: -86.8689,
  ZIP: '37064',
  LOCATION_LABEL: 'Franklin, TN',
};
