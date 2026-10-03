import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/live.dart';
import '../ui/map.dart';
import '../ui/theme.dart';

class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});
  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  final _map = MapController();
  final _query = TextEditingController();
  LatLng? _from, _to;
  bool _walk = true, _busy = false;
  String _leave = 'now';
  List<Map<String, dynamic>> _results = [], _hotspots = [];
  Map<String, dynamic>? _plan;
  Map<String, dynamic>? _selected;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _locate();
    Api.instance.get('/api/hotspots').then((h) { if (mounted) setState(() => _hotspots = (h as List).cast<Map<String, dynamic>>()); }).catchError((_) {});
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    final p = await currentPosition();
    if (p == null) {
      if (mounted) snack(context, 'Allow location access so routes can start from where you are.', error: true);
      return;
    }
    setState(() => _from = LatLng(p.latitude, p.longitude));
    _map.move(_from!, 15);
  }

  void _search(String q) {
    _debounce?.cancel();
    if (q.trim().length < 3) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      try {
        final r = await Api.instance.get('/api/places', {'q': q.trim()});
        if (mounted) setState(() => _results = (r as List).cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  void _setTo(LatLng p) => setState(() { _to = p; _plan = null; _selected = null; _results = []; });

  DateTime? _departure() {
    if (_leave == 'now') return null;
    final now = DateTime.now();
    if (_leave == '1h') return now.add(const Duration(hours: 1));
    var d = DateTime(now.year, now.month, now.day, int.parse(_leave));
    if (d.isBefore(now)) d = d.add(const Duration(days: 1));
    return d;
  }

  Future<void> _find() async {
    if (_from == null || _to == null) return;
    setState(() => _busy = true);
    try {
      final p = await Api.instance.post('/api/routes', {
        'from': {'lat': _from!.latitude, 'lng': _from!.longitude}, 'to': {'lat': _to!.latitude, 'lng': _to!.longitude},
        'walk': _walk, 'departAt': _departure()?.toUtc().toIso8601String(),
      }) as Map<String, dynamic>;
      setState(() { _plan = p; _selected = p.list('routes').first; });
      _fit();
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<LatLng> _path(Map<String, dynamic> r) => [for (final p in (r['path'] as List)) LatLng(((p as List)[0] as num).toDouble(), (p[1] as num).toDouble())];

  void _fit() {
    final s = _selected;
    if (s == null) return;
    _map.fitCamera(CameraFit.bounds(bounds: LatLngBounds.fromPoints(_path(s)), padding: const EdgeInsets.all(40)));
  }

  /// Share live for about the trip, with a check-in deadline: friends are alerted if you don't arrive.
  Future<void> _shareTrip() async {
    final s = _selected;
    if (s == null) return;
    final tripMin = (s.dbl('durationS') / 60).ceil();
    final checkIn = (tripMin + 15).clamp(10, 720);
    final share = checkIn <= 60 ? 60 : checkIn <= 480 ? 480 : null;
    try {
      await Api.instance.post('/api/location/share', {'minutes': share, 'friendIds': [], 'checkInMinutes': checkIn});
      await Live.instance.refresh();
      Live.instance.sendNow();
      if (mounted) {
        snack(context, t('live.sharing'));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final routes = _plan?.list('routes') ?? [];
    return Scaffold(
      appBar: AppBar(title: Text(t('nav.route'))),
      body: Column(children: [
        SizedBox(
          height: 280,
          child: FlutterMap(
            mapController: _map,
            options: MapOptions(initialCenter: defaultCenter, initialZoom: 14, onTap: (_, p) { _query.clear(); _setTo(p); }),
            children: [
              baseTiles(),
              CircleLayer(circles: [
                for (final h in _hotspots)
                  CircleMarker(point: LatLng(h.dbl('centerLatitude'), h.dbl('centerLongitude')), radius: h.dbl('radiusMeters'), useRadiusInMeter: true,
                      color: riskLevel(h.optDbl('riskNow') ?? h.dbl('intensityScore')).color.withValues(alpha: 0.15)),
              ]),
              PolylineLayer(polylines: [
                for (final r in routes.where((r) => r != _selected))
                  Polyline(points: _path(r), strokeWidth: 4, color: const Color(0xFF8A96A3), pattern: StrokePattern.dashed(segments: const [8, 8])),
                if (_selected != null)
                  Polyline(points: _path(_selected!), strokeWidth: 6, color: _selected!['kind'] == 'FASTEST' ? CS.ink : CS.safe),
              ]),
              MarkerLayer(markers: [
                if (_from != null) Marker(point: _from!, width: 22, height: 22, child: meDot()),
                if (_to != null) Marker(point: _to!, width: 24, height: 24, child: dot(CS.vest, size: 22)),
              ]),
              osmAttribution(),
            ],
          ),
        ),
        Expanded(
          child: Constrained(
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Text(t('route.intro'), style: const TextStyle(color: CS.muted)),
              const SizedBox(height: 10),
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.my_location), title: Text('${t('route.from')}: ${_from == null ? '…' : t('route.myLocation')}')),
              TextField(controller: _query, onChanged: _search, decoration: InputDecoration(labelText: t('route.to'), hintText: t('route.search'), prefixIcon: const Icon(Icons.place))),
              for (final r in _results)
                ListTile(
                  title: Text(r.str('name')),
                  subtitle: Text(r.str('detail'), maxLines: 1, overflow: TextOverflow.ellipsis),
                  onTap: () { _query.text = r.str('name'); _setTo(LatLng(r.dbl('lat'), r.dbl('lng'))); _map.move(_to!, 15); },
                ),
              const SizedBox(height: 10),
              SegmentedButton<bool>(
                segments: [ButtonSegment(value: true, label: Text(t('route.walk')), icon: const Icon(Icons.directions_walk)),
                  ButtonSegment(value: false, label: Text(t('route.drive')), icon: const Icon(Icons.directions_car))],
                selected: {_walk},
                onSelectionChanged: (s) => setState(() => _walk = s.first),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _leave,
                decoration: InputDecoration(labelText: t('route.leave')),
                items: [
                  DropdownMenuItem(value: 'now', child: Text(t('fake.now'))),
                  DropdownMenuItem(value: '1h', child: Text(t('route.leave1h'))),
                  DropdownMenuItem(value: '18', child: Text(t('route.tonight', {'t': '18:00'}))),
                  DropdownMenuItem(value: '21', child: Text(t('route.tonight', {'t': '21:00'}))),
                ],
                onChanged: (v) => setState(() => _leave = v ?? 'now'),
              ),
              const SizedBox(height: 12),
              FilledButton(onPressed: _busy || _from == null || _to == null ? null : _find, child: Text(_busy ? t('route.finding') : t('route.find'))),
              for (final r in routes)
                Card(
                  margin: const EdgeInsets.only(top: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: r == _selected ? CS.ink : CS.line, width: 2)),
                  child: ListTile(
                    onTap: () { setState(() => _selected = r); _fit(); },
                    title: Text(t('route.${r['kind']}'), style: TextStyle(fontWeight: FontWeight.w700, color: r['kind'] == 'FASTEST' ? null : CS.safe)),
                    subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${km(r.dbl('distanceM'))} · ${mins(r.dbl('durationS'))}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      (r['hotspotsPassed'] as List).isEmpty
                          ? Text(t('route.clear'), style: const TextStyle(color: CS.safe))
                          : Text(t('route.passes', {'list': (r['hotspotsPassed'] as List).join(', ')}), style: const TextStyle(color: CS.risk)),
                    ]),
                  ),
                ),
              if (_selected != null) ...[
                const SizedBox(height: 12),
                FilledButton(style: vestButton(), onPressed: _shareTrip, child: Text(t('route.share'))),
                Text(t('route.shareNote'), style: const TextStyle(color: CS.muted, fontSize: 13)),
              ],
            ]),
          ),
        ),
      ]),
    );
  }
}
