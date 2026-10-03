import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api.dart';

@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  // Notification messages are shown by Android itself when the app is in the background.
}

/// Push notifications through Firebase Cloud Messaging. If the app was built without Firebase
/// configuration, [enabled] stays false and everything else keeps working.
class Push {
  Push._();
  static final instance = Push._();

  bool enabled = false;
  final _local = FlutterLocalNotificationsPlugin();

  /// Called with the in-app route ("/alerts/…") when a notification is tapped.
  void Function(String url)? onOpen;
  String? _pendingUrl;

  Future<void> init() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _local.initialize(const InitializationSettings(android: android),
        onDidReceiveNotificationResponse: (r) => _open(r.payload));
    final plugin = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await plugin?.createNotificationChannel(const AndroidNotificationChannel('sos', 'Emergency alerts',
        description: 'SOS alerts from friends', importance: Importance.max));
    await plugin?.createNotificationChannel(const AndroidNotificationChannel('general', 'Updates',
        description: 'Friend requests, nearby incidents and group posts', importance: Importance.defaultImportance));

    try {
      await Firebase.initializeApp();
      enabled = true;
    } catch (_) {
      debugPrint('Firebase not configured: push notifications are off');
      return;
    }
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data['url'] as String?));
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _pendingUrl = initial.data['url'] as String?;
    FirebaseMessaging.instance.onTokenRefresh.listen((t) => _register(t));
  }

  /// After sign-in: ask permission (Android 13+) and register this phone for notifications.
  Future<void> registerDevice() async {
    await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
    if (!enabled) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _register(token);
    } catch (_) {}
  }

  Future<void> unregisterDevice() async {
    if (!enabled) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await Api.instance.post('/api/devices/remove', {'token': token, 'platform': 'android'});
    } catch (_) {}
  }

  Future<void> _register(String token) async {
    try {
      await Api.instance.post('/api/devices', {'token': token, 'platform': 'android'});
    } catch (_) {}
  }

  /// The app is open: Android doesn't show the notification itself, so we do.
  Future<void> _showForeground(RemoteMessage m) async {
    final n = m.notification;
    if (n == null) return;
    final urgent = m.data['urgent'] == 'true';
    await _local.show(
      m.hashCode,
      n.title,
      n.body,
      NotificationDetails(android: AndroidNotificationDetails(
        urgent ? 'sos' : 'general', urgent ? 'Emergency alerts' : 'Updates',
        importance: urgent ? Importance.max : Importance.defaultImportance,
        priority: urgent ? Priority.max : Priority.defaultPriority,
      )),
      payload: m.data['url'] as String?,
    );
  }

  void _open(String? url) {
    if (url == null || url.isEmpty) return;
    if (onOpen != null) {
      onOpen!(url);
    } else {
      _pendingUrl = url;
    }
  }

  /// A notification that launched the app, to open once the UI is ready.
  String? takePending() {
    final u = _pendingUrl;
    _pendingUrl = null;
    return u;
  }
}
