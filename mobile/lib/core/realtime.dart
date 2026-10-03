import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'auth.dart';
import 'config.dart';

/// Live updates from the server ("something changed" events; screens re-fetch). Reconnects with backoff,
/// re-authenticates before the access token expires, and pings to keep mobile networks from dropping it.
class Realtime {
  Realtime._();
  static final instance = Realtime._();

  final connected = ValueNotifier<bool>(false);
  final _events = StreamController<String>.broadcast();
  final _notices = StreamController<String>.broadcast();
  Stream<String> get events => _events.stream;
  Stream<String> get notices => _notices.stream;

  WebSocketChannel? _ch;
  Timer? _ping, _reauth;
  int _retry = 0;
  bool _running = false;

  Stream<String> on(Set<String> types) => events.where(types.contains);

  void start() {
    if (_running) return;
    _running = true;
    _connect();
  }

  void stop() {
    _running = false;
    _ch?.sink.close();
    _cleanup();
  }

  Future<void> _connect() async {
    if (!_running) return;
    try {
      final ch = WebSocketChannel.connect(Uri.parse(AppConfig.wsUrl));
      _ch = ch;
      await ch.ready;
      await _auth();
      ch.stream.listen(_onMessage, onDone: _reconnect, onError: (_) => _reconnect(), cancelOnError: true);
      _ping = Timer.periodic(const Duration(seconds: 25), (_) => _send({'type': 'ping'}));
      _reauth = Timer.periodic(const Duration(minutes: 4), (_) => _auth());
    } catch (_) {
      _reconnect();
    }
  }

  Future<void> _auth() async {
    final token = await Auth.instance.validAccessToken();
    if (token != null) _send({'type': 'auth', 'token': token});
  }

  void _onMessage(dynamic data) {
    try {
      final m = jsonDecode(data as String) as Map<String, dynamic>;
      final type = m['type'] as String?;
      if (type == 'ready') {
        _retry = 0;
        connected.value = true;
        for (final t in const ['live', 'reports', 'hotspots', 'friends', 'groups', 'outages']) {
          _events.add(t);
        }
      } else if (type == 'notice') {
        _notices.add(m['text'] as String? ?? '');
      } else if (type != null && type != 'pong') {
        _events.add(type);
      }
    } catch (_) {}
  }

  void _send(Map<String, dynamic> m) {
    try {
      _ch?.sink.add(jsonEncode(m));
    } catch (_) {}
  }

  void _cleanup() {
    _ping?.cancel();
    _reauth?.cancel();
    connected.value = false;
  }

  void _reconnect() {
    _cleanup();
    if (!_running) return;
    final delay = Duration(milliseconds: (1000 * (1 << _retry.clamp(0, 5))).clamp(1000, 30000));
    _retry++;
    Timer(delay, _connect);
  }
}
