/// Server addresses. Same backend as the web app.
class AppConfig {
  static const apiUrl = 'https://crimespot-api.onrender.com';
  static const wsUrl = 'wss://crimespot-api.onrender.com/ws';
  static const webUrl = 'https://crimespot-web.onrender.com';
  static const keycloakUrl = 'https://crimespot-auth.onrender.com';
  static const realm = 'crimespot';
  static const clientId = 'crimespot-web';
  static const redirectUrl = 'za.co.crimespot.app:/oauth2redirect';
  static const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  static const userAgentPackage = 'za.co.crimespot.app';

  static String get issuer => '$keycloakUrl/realms/$realm';
}
