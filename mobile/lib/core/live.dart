import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api.dart';
import 'auth.dart';
import 'geo.dart';
import 'i18n.dart';
import 'realtime.dart';

/// Sharing state, friends' alerts and walks, plus background location while sharing.
///
/// When you share your location, have an active SOS, or walk with a friend, GPS keeps running through an
/// Android foreground service (visible "Sharing your location" notification), even if the app is closed.
/// It stops as soon as sharing ends.
class Live extends ChangeNotifier {
  Live._();
  static final instance = Live._();

  Map<String, dynamic>? state;   // GET /api/live
  Map<String, dynamic>? escort;  // GET /api/escort
  String? gpsError;
  DateTime? lastSent;

  StreamSubscription<Position>? _gps;
  StreamSubscription<String>? _events;
  Timer? _poll;
  DateTime _lastRefresh = DateTime.fromMillisecondsSinceEpoch(0);
  Position? _lastSentPos;

  bool get sharing => state?['sharing'] == true;
  Map<String, dynamic>? get myAlert => state?['myAlert'] as Map<String, dynamic>?;
  Map<String, dynamic>? get myShare => state?['myShare'] as Map<String, dynamic>?;
  List<Map<String, dynamic>> get friendAlerts => ((state?['alerts'] as List?) ?? const []).cast<Map<String, dynamic>>();
  List<Map<String, dynamic>> get friendsSharing => ((state?['friends'] as List?) ?? const []).cast<Map<String, dynamic>>();
  Map<String, dynamic>? get walk => escort?['asWalker'] as Map<String, dynamic>?;
  List<Map<String, dynamic>> get escorting => ((escort?['asEscort'] as List?) ?? const []).cast<Map<String, dynamic>>();
  List<Map<String, dynamic>> get walkRequests => ((escort?['incoming'] as List?) ?? const []).cast<Map<String, dynamic>>();

  void start() {
    _events ??= Realtime.instance.on({'live', 'friends'}).listen((_) => refresh());
    // With a live socket, events drive refreshes; polling is a slow safety net.
    _poll ??= Timer.periodic(const Duration(seconds: 15), (_) {
      if (!Auth.instance.signedIn.value) return;
      if (Realtime.instance.connected.value && DateTime.now().difference(_lastRefresh).inSeconds < 60) return;
      refresh();
    });
    refresh();
  }

  void stop() {
    _events?.cancel();
    _events = null;
    _poll?.cancel();
    _poll = null;
    _stopGps();
    state = escort = null;
    notifyListeners();
  }

  Future<void> refresh() async {
    _lastRefresh = DateTime.now();
    try {
      state = (await Api.instance.get('/api/live')) as Map<String, dynamic>;
      escort = (await Api.instance.get('/api/escort')) as Map<String, dynamic>;
      notifyListeners();
      sharing ? _startGps() : _stopGps();
    } catch (_) {}
  }

  /// Send one position straight away (e.g. right after sharing starts).
  Future<void> sendNow() async {
    final p = await currentPosition();
    if (p != null) await _send(p, force: true);
  }

  void _startGps() {
    if (_gps != null) return;
    final settings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
      intervalDuration: const Duration(seconds: 10),
      foregroundNotificationConfig: ForegroundNotificationConfig(
        notificationTitle: t('app.bgLocation'),
        notificationText: t('app.bgLocationText'),
        enableWakeLock: true,
        setOngoing: true,
      ),
    );
    ensureLocationPermission().then((ok) {
      if (!ok) {
        gpsError = 'Location access is off. Allow it so friends can see you.';
        notifyListeners();
        return;
      }
      _gps = Geolocator.getPositionStream(locationSettings: settings).listen(
        (p) { gpsError = null; _send(p); },
        onError: (_) { gpsError = "Can't get your location right now."; notifyListeners(); },
      );
    });
  }

  void _stopGps() {
    _gps?.cancel();
    _gps = null;
    _lastSentPos = null;
  }

  Future<void> _send(Position p, {bool force = false}) async {
    final last = _lastSentPos;
    if (!force && last != null && lastSent != null) {
      final recent = DateTime.now().difference(lastSent!).inSeconds < 15;
      final moved = metersBetween(last.latitude, last.longitude, p.latitude, p.longitude) >= 25;
      if (recent && !moved) return;
    }
    _lastSentPos = p;
    lastSent = DateTime.now();
    try {
      await Api.instance.post('/api/location', {'latitude': p.latitude, 'longitude': p.longitude, 'accuracyM': p.accuracy.round()});
      notifyListeners();
    } on ApiException catch (e) {
      if (e.status == 409) refresh(); // sharing ended elsewhere
    }
  }
}
