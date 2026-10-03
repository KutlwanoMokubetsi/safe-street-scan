import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../screens/alert_screen.dart';
import '../screens/group_detail_screen.dart';
import '../screens/groups_screen.dart';
import '../screens/friends_screen.dart';
import '../screens/map_screen.dart';
import '../screens/report_detail_screen.dart';
import '../screens/sos_screen.dart';

final navigatorKey = GlobalKey<NavigatorState>();

/// Shell tab switching (set by the shell): 0 home, 1 map, 2 SOS, 3 live, 4 more.
void Function(int tab)? switchTab;

Future<T?> push<T>(Widget screen) => navigatorKey.currentState!.push<T>(MaterialPageRoute(builder: (_) => screen));

/// Opens an in-app link from a notification ("/alerts/…", "/reports/…", "/map?lat=…").
void openUrl(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  final seg = uri.pathSegments;
  if (seg.isEmpty) {
    switchTab?.call(0);
    return;
  }
  switch (seg[0]) {
    case 'alerts' when seg.length > 1:
      push(AlertScreen(id: seg[1]));
    case 'reports' when seg.length > 1:
      push(ReportDetailScreen(id: seg[1]));
    case 'groups' when seg.length > 1:
      push(GroupDetailScreen(id: seg[1]));
    case 'groups':
      push(const GroupsScreen());
    case 'friends':
      push(const FriendsScreen());
    case 'live':
      switchTab?.call(3);
    case 'sos':
      push(const SosScreen());
    case 'map':
      final lat = double.tryParse(uri.queryParameters['lat'] ?? ''), lng = double.tryParse(uri.queryParameters['lng'] ?? '');
      push(MapScreen(focus: lat != null && lng != null ? LatLng(lat, lng) : null, standalone: true));
    default:
      switchTab?.call(0);
  }
}
