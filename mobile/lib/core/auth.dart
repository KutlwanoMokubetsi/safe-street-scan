import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api.dart';
import 'config.dart';

/// Sign-in with Keycloak through the phone's browser (Custom Tabs, PKCE), so Google sign-in works.
/// Tokens are kept in the Android Keystore and refreshed silently.
class Auth {
  Auth._();
  static final instance = Auth._();

  final _appAuth = const FlutterAppAuth();
  final _store = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  final signedIn = ValueNotifier<bool>(false);
  final user = ValueNotifier<Map<String, dynamic>?>(null);

  String? _access, _refresh, _idToken;
  DateTime? _expires;
  Future<String?>? _refreshing;

  static final _config = AuthorizationServiceConfiguration(
    authorizationEndpoint: '${AppConfig.issuer}/protocol/openid-connect/auth',
    tokenEndpoint: '${AppConfig.issuer}/protocol/openid-connect/token',
    endSessionEndpoint: '${AppConfig.issuer}/protocol/openid-connect/logout',
  );
  static final _registerConfig = AuthorizationServiceConfiguration(
    authorizationEndpoint: '${AppConfig.issuer}/protocol/openid-connect/registrations',
    tokenEndpoint: '${AppConfig.issuer}/protocol/openid-connect/token',
  );

  String? get userId => user.value?['id'] as String?;
  bool get canModerate => const ['MODERATOR', 'ADMIN'].contains(user.value?['role']);

  /// Restore the saved session. Returns true if signed in.
  Future<bool> restore() async {
    _refresh = await _store.read(key: 'refresh');
    _idToken = await _store.read(key: 'id');
    if (_refresh == null) return false;
    final token = await validAccessToken(force: true);
    signedIn.value = token != null;
    if (signedIn.value) await loadUser();
    return signedIn.value;
  }

  Future<void> signIn({bool google = false, bool register = false}) async {
    final res = await _appAuth.authorizeAndExchangeCode(AuthorizationTokenRequest(
      AppConfig.clientId,
      AppConfig.redirectUrl,
      serviceConfiguration: register ? _registerConfig : _config,
      scopes: const ['openid', 'profile', 'email'],
      additionalParameters: google ? const {'kc_idp_hint': 'google'} : null,
    ));
    await _save(res.accessToken, res.refreshToken, res.idToken, res.accessTokenExpirationDateTime);
    signedIn.value = true;
    await loadUser();
  }

  Future<void> loadUser() async {
    try {
      user.value = (await Api.instance.get('/api/me')) as Map<String, dynamic>;
    } catch (_) {}
  }

  /// A token valid for at least another 30 seconds, refreshing if needed (one refresh at a time).
  Future<String?> validAccessToken({bool force = false}) async {
    if (!force && _access != null && _expires != null && _expires!.isAfter(DateTime.now().add(const Duration(seconds: 30)))) {
      return _access;
    }
    if (_refresh == null) return null;
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _doRefresh() async {
    try {
      final res = await _appAuth.token(TokenRequest(AppConfig.clientId, AppConfig.redirectUrl,
          serviceConfiguration: _config, refreshToken: _refresh, scopes: const ['openid', 'profile', 'email']));
      await _save(res.accessToken, res.refreshToken ?? _refresh, res.idToken ?? _idToken, res.accessTokenExpirationDateTime);
      return _access;
    } catch (_) {
      return null; // offline or session expired; callers handle null
    }
  }

  Future<void> _save(String? access, String? refresh, String? id, DateTime? expires) async {
    _access = access;
    _refresh = refresh;
    _idToken = id;
    _expires = expires ?? DateTime.now().add(const Duration(minutes: 4));
    if (refresh != null) await _store.write(key: 'refresh', value: refresh);
    if (id != null) await _store.write(key: 'id', value: id);
  }

  Future<void> signOut() async {
    final id = _idToken;
    await signedOut();
    if (id != null) {
      try {
        await _appAuth.endSession(EndSessionRequest(idTokenHint: id, postLogoutRedirectUrl: AppConfig.redirectUrl, serviceConfiguration: _config));
      } catch (_) {}
    }
  }

  /// Clears the local session (used when the server says the session ended).
  Future<void> signedOut() async {
    _access = _refresh = _idToken = null;
    _expires = null;
    await _store.deleteAll();
    user.value = null;
    signedIn.value = false;
  }

  /// Subject claim from the access token, for diagnostics.
  String? get subject {
    final parts = _access?.split('.');
    if (parts == null || parts.length != 3) return null;
    try {
      return jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))))['sub'] as String?;
    } catch (_) {
      return null;
    }
  }
}
