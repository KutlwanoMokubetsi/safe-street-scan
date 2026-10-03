import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'auth.dart';
import 'config.dart';
import 'i18n.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// HTTP client for the CrimeSpot API: adds a fresh token and the app language, turns errors into
/// one readable sentence, and tracks whether the server is reachable.
class Api {
  Api._();
  static final instance = Api._();
  final _client = http.Client();

  /// True after repeated network or 5xx failures, so the app can say the server isn't responding.
  final serverDown = ValueNotifier<bool>(false);
  int _failures = 0;

  Future<Map<String, String>> _headers({String? contentType = 'application/json'}) async {
    final token = await Auth.instance.validAccessToken();
    return {
      if (contentType != null) 'Content-Type': contentType,
      'Accept-Language': I18n.lang.value,
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse('${AppConfig.apiUrl}$path').replace(queryParameters: query);

  Future<dynamic> get(String path, [Map<String, String>? query]) async =>
      _handle(() async => _client.get(_uri(path, query), headers: await _headers()));
  Future<dynamic> post(String path, [Object? body]) async =>
      _handle(() async => _client.post(_uri(path), headers: await _headers(), body: jsonEncode(body ?? {})));
  Future<dynamic> put(String path, [Object? body]) async =>
      _handle(() async => _client.put(_uri(path), headers: await _headers(), body: jsonEncode(body ?? {})));
  Future<dynamic> patch(String path, [Object? body]) async =>
      _handle(() async => _client.patch(_uri(path), headers: await _headers(), body: jsonEncode(body ?? {})));
  Future<dynamic> delete(String path) async => _handle(() async => _client.delete(_uri(path), headers: await _headers()));

  Future<dynamic> putBytes(String path, Uint8List bytes, String contentType) async =>
      _handle(() async => _client.put(_uri(path), headers: await _headers(contentType: contentType), body: bytes));

  Future<Uint8List> getBytes(String path) async {
    final res = await _send(() async => _client.get(_uri(path), headers: await _headers()));
    return res.bodyBytes;
  }

  Future<dynamic> _handle(Future<http.Response> Function() call) async {
    final res = await _send(call);
    if (res.body.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  Future<http.Response> _send(Future<http.Response> Function() call) async {
    http.Response res;
    try {
      res = await call().timeout(const Duration(seconds: 30));
    } catch (_) {
      _fail();
      throw ApiException(0, "Can't reach the server. Check your connection, or wait a minute if it's waking up.");
    }
    if (res.statusCode >= 502) {
      _fail();
    } else {
      _failures = 0;
      serverDown.value = false;
    }
    if (res.statusCode == 401) {
      await Auth.instance.signedOut();
      throw ApiException(401, 'Your session ended. Sign in again.');
    }
    if (res.statusCode >= 400) {
      String msg = 'Something went wrong. Try again.';
      try {
        final j = jsonDecode(utf8.decode(res.bodyBytes));
        if (j is Map && (j['detail'] ?? j['message']) != null) msg = (j['detail'] ?? j['message']).toString();
      } catch (_) {}
      if (res.statusCode == 429) msg = 'Too many requests. Wait a moment and try again.';
      throw ApiException(res.statusCode, msg);
    }
    return res;
  }

  void _fail() {
    if (++_failures >= 2) serverDown.value = true;
  }
}
