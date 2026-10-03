import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/map.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'report_detail_screen.dart';
import 'report_new_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, this.focus, this.standalone = false});
  final LatLng? focus;
  final bool standalone;
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _map = MapController();
  List<Map<String, dynamic>> _reports = [], _hotspots = [], _zones = [];
  bool _mineOutage = false;
  LatLng? _me;
  int _days = 30;
  bool _verifiedOnly = false;
  Set<String> _shown = {'violent', 'property', 'other'};
  bool _loading = false;
  Timer? _debounce;
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    _loadFilters();
    _sub = Realtime.instance.on({'reports', 'hotspots', 'outages'}).listen((_) => _reload());
    if (widget.focus == null) _locate(move: true);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadFilters() async {
    final p = await SharedPreferences.getInstance();
    setState(() {
      _days = p.getInt('map.days') ?? 30;
      _verifiedOnly = p.getBool('map.verified') ?? false;
      _shown = (p.getStringList('map.shown') ?? ['violent', 'property', 'other']).toSet();
    });
  }

  Future<void> _saveFilters() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt('map.days', _days);
    await p.setBool('map.verified', _verifiedOnly);
    await p.setStringList('map.shown', _shown.toList());
  }

  void _reload() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _fetch);
  }

  Future<void> _fetch() async {
    LatLngBounds b;
    try {
      b = _map.camera.visibleBounds;
    } catch (_) {
      return; // map not laid out yet
    }
    setState(() => _loading = true);
    try {
      final padLat = (b.north - b.south) * 0.25, padLng = (b.east - b.west) * 0.25;
      final r = await Future.wait([
        Api.instance.get('/api/reports', {
          'minLat': '${b.south - padLat}', 'maxLat': '${b.north + padLat}', 'minLng': '${b.west - padLng}', 'maxLng': '${b.east + padLng}',
          'days': '$_days', 'verifiedOnly': '$_verifiedOnly',
        }),
        Api.instance.get('/api/hotspots'),
        Api.instance.get('/api/outages'),
      ]);
      if (!mounted) return;
      setState(() {
        _reports = (r[0] as List).cast<Map<String, dynamic>>();
        _hotspots = (r[1] as List).cast<Map<String, dynamic>>();
        final o = r[2] as Map<String, dynamic>;
        _zones = o.list('zones');
        _mineOutage = o.flag('mineOpen');
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        snack(context, '$e', error: true);
      }
    }
  }

  Future<void> _locate({bool move = false}) async {
    final p = await currentPosition();
    if (p == null) {
      if (!move && mounted) snack(context, 'Location is off. Allow location access to use this.', error: true);
      return;
    }
    setState(() => _me = LatLng(p.latitude, p.longitude));
    _map.move(_me!, 15);
  }

  /// Groups reports that are close on screen at this zoom (same approach as the web map).
  List<Widget> _markers() {
    final cam = _map.camera;
    final visible = _reports.where((r) => _shown.contains(severityOf(r.opt('crimeType')))).toList();
    final cells = <String, List<Map<String, dynamic>>>{};
    for (final r in visible) {
      final p = cam.projectAtZoom(LatLng(r.dbl('latitude'), r.dbl('longitude')));
      cells.putIfAbsent('${(p.dx / 56).floor()}:${(p.dy / 56).floor()}', () => []).add(r);
    }
    final markers = <Marker>[];
    for (final g in cells.values) {
      if (g.length == 1) {
        final r = g.first;
        markers.add(Marker(
          point: LatLng(r.dbl('latitude'), r.dbl('longitude')),
          width: 34, height: 34,
          child: Semantics(
            button: true,
            label: crimeLabel(r.opt('crimeType')),
            child: GestureDetector(onTap: () => _showReport(r), child: Center(child: dot(severityColors[severityOf(r.opt('crimeType'))]!, hollow: r['status'] != 'VERIFIED'))),
          ),
        ));
      } else {
        final lat = g.map((r) => r.dbl('latitude')).reduce((a, b) => a + b) / g.length;
        final lng = g.map((r) => r.dbl('longitude')).reduce((a, b) => a + b) / g.length;
        final size = math.min(52.0, 32 + (math.log(g.length) / math.ln2) * 6);
        markers.add(Marker(
          point: LatLng(lat, lng),
          width: size, height: size,
          child: Semantics(
            button: true,
            label: '${g.length} reports',
            child: GestureDetector(
              onTap: () => _map.fitCamera(CameraFit.bounds(
                  bounds: LatLngBounds.fromPoints([for (final r in g) LatLng(r.dbl('latitude'), r.dbl('longitude'))]),
                  padding: const EdgeInsets.all(60), maxZoom: 18)),
              child: Container(
                decoration: BoxDecoration(color: CS.ink, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3),
                    boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 5)]),
                alignment: Alignment.center,
                child: Text('${g.length}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ));
      }
    }
    return [MarkerLayer(markers: markers)];
  }

  void _showReport(Map<String, dynamic> r) => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (c) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: TypeTag(r.opt('crimeType'))), StatusText(r.str('status'))]),
            const SizedBox(height: 8),
            Text(r.str('description')),
            const SizedBox(height: 6),
            Text('${r.opt('locationName') ?? 'Pinned location'} · ${timeAgo(r.opt('occurredAt'))}', style: const TextStyle(color: CS.muted)),
            if (r.flag('reporterTrusted')) Padding(padding: const EdgeInsets.only(top: 6), child: Text('✓ ${t('seen.trusted')}', style: const TextStyle(color: CS.safe, fontWeight: FontWeight.w600))),
            if (r.integer('confirmations') > 0) Text(t('seen.count', {'n': r.integer('confirmations')}), style: const TextStyle(color: CS.muted)),
            const SizedBox(height: 14),
            FilledButton(onPressed: () { Navigator.pop(c); push(ReportDetailScreen(id: r.str('id'))); }, child: const Text('Details and comments')),
          ]),
        ),
      );

  void _showHotspot(Map<String, dynamic> h) {
    final risk = riskLevel(h.optDbl('riskNow') ?? h.dbl('intensityScore'));
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (c) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(h.str('name'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text('${h.integer('crimeCount')} incidents in the last 30 days, mostly ${crimeLabel(h.opt('topCrimeType')).toLowerCase()}.'),
          const SizedBox(height: 6),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${t('risk.now')}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: risk.label, style: TextStyle(color: risk.color, fontWeight: FontWeight.w700)),
            if (h['peakDays'] != null) TextSpan(text: ' · ${t(h['peakDays'] == 'WEEKEND' ? 'risk.weekends' : 'risk.weekdays')}'),
          ])),
          if (h['peakHours'] != null) Text('Most incidents happen ${h['peakHours']}.'),
          if (h['trend'] == 'RISING') const Text('▲ Rising: more incidents this week than usual', style: TextStyle(color: CS.risk)),
          if (h['trend'] == 'FALLING') const Text('▼ Falling: fewer incidents this week than usual', style: TextStyle(color: CS.safe)),
        ]),
      ),
    );
  }

  void _showZone(Map<String, dynamic> z) => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (c) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('⚡ ${t('outage.zone', {'n': z.integer('reports'), 't': hhmm(z.opt('since'))})}', style: Theme.of(context).textTheme.titleMedium),
            if (z['hotspot'] != null) Padding(padding: const EdgeInsets.only(top: 8),
                child: Text(t('outage.hotspot', {'name': z['hotspot']}), style: const TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w600))),
          ]),
        ),
      );

  void _power() => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (c) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('⚡ ${t('outage.button')}', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(t('outage.help'), style: const TextStyle(color: CS.muted)),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () async {
                Navigator.pop(c);
                final p = await currentPosition();
                if (p == null) {
                  if (mounted) snack(context, 'Allow location access to report an outage.', error: true);
                  return;
                }
                try {
                  await Api.instance.post('/api/outages', {'lat': p.latitude, 'lng': p.longitude});
                  if (mounted) snack(context, t('outage.help'));
                  _fetch();
                } catch (e) {
                  if (mounted) snack(context, '$e', error: true);
                }
              },
              child: Text(t('outage.out')),
            ),
            if (_mineOutage) ...[
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () async { Navigator.pop(c); await Api.instance.post('/api/outages/restored'); _fetch(); }, child: Text(t('outage.back'))),
            ],
          ]),
        ),
      );

  Widget _chip(String label, bool on, VoidCallback tap, {Color? dotColor}) => Padding(
        padding: const EdgeInsets.only(right: 6),
        child: FilterChip(
          selected: on,
          showCheckmark: false,
          avatar: dotColor == null ? null : CircleAvatar(backgroundColor: on ? dotColor : dotColor.withValues(alpha: 0.35), radius: 5),
          label: Text(label),
          onSelected: (_) => tap(),
          selectedColor: CS.ink,
          labelStyle: TextStyle(color: on ? Colors.white : null, fontWeight: FontWeight.w600),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final body = Stack(children: [
      FlutterMap(
        mapController: _map,
        options: MapOptions(
          initialCenter: widget.focus ?? defaultCenter,
          initialZoom: widget.focus != null ? 16 : 14,
          onMapReady: _reload,
          onMapEvent: (e) {
            if (e is MapEventMoveEnd || e is MapEventFlingAnimationEnd || e is MapEventDoubleTapZoomEnd || e is MapEventScrollWheelZoom) _reload();
            if (e is MapEventMove) setState(() {}); // re-cluster while zooming
          },
        ),
        children: [
          baseTiles(),
          CircleLayer(circles: [
            for (final h in _hotspots)
              CircleMarker(
                point: LatLng(h.dbl('centerLatitude'), h.dbl('centerLongitude')),
                radius: h.dbl('radiusMeters'),
                useRadiusInMeter: true,
                color: riskLevel(h.optDbl('riskNow') ?? h.dbl('intensityScore')).color.withValues(alpha: 0.06 + (h.optDbl('riskNow') ?? h.dbl('intensityScore')) * 0.16),
              ),
            for (final z in _zones)
              CircleMarker(point: LatLng(z.dbl('lat'), z.dbl('lng')), radius: z.dbl('radiusM'), useRadiusInMeter: true,
                  color: CS.vest.withValues(alpha: 0.14), borderColor: const Color(0xFFB8860B), borderStrokeWidth: 2),
          ]),
          // Invisible tap targets for hotspot and outage areas (circle layers aren't tappable).
          MarkerLayer(markers: [
            for (final h in _hotspots)
              Marker(point: LatLng(h.dbl('centerLatitude'), h.dbl('centerLongitude')), width: 44, height: 44,
                  child: Semantics(button: true, label: 'Hotspot ${h.str('name')}', child: GestureDetector(onTap: () => _showHotspot(h), child: const Icon(Icons.local_fire_department, color: Color(0xAAC0392B), size: 22)))),
            for (final z in _zones)
              Marker(point: LatLng(z.dbl('lat'), z.dbl('lng')), width: 40, height: 40,
                  child: Semantics(button: true, label: 'Power outage', child: GestureDetector(onTap: () => _showZone(z), child: const Icon(Icons.bolt, color: Color(0xFFB8860B), size: 26)))),
          ]),
          ..._markers(),
          if (_me != null) MarkerLayer(markers: [Marker(point: _me!, width: 22, height: 22, child: meDot())]),
          osmAttribution(),
        ],
      ),
      Positioned(
        top: 8, left: 8, right: 8,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final d in const [7, 30, 90]) _chip('$d days', _days == d, () { setState(() => _days = d); _saveFilters(); _reload(); }),
            for (final s in const ['violent', 'property', 'other'])
              _chip(severityLabels[s]!, _shown.contains(s), () {
                setState(() { if (_shown.contains(s) && _shown.length > 1) { _shown.remove(s); } else { _shown.add(s); } });
                _saveFilters();
              }, dotColor: severityColors[s]),
            _chip('Verified only', _verifiedOnly, () { setState(() => _verifiedOnly = !_verifiedOnly); _saveFilters(); _reload(); }),
          ]),
        ),
      ),
      if (_loading) const Positioned(top: 60, left: 0, right: 0, child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)))),
      Positioned(
        right: 12, bottom: 16,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          FloatingActionButton.small(heroTag: 'power', onPressed: _power, tooltip: t('outage.button'), child: const Icon(Icons.bolt)),
          const SizedBox(height: 10),
          FloatingActionButton.small(heroTag: 'me', onPressed: _locate, tooltip: 'My location', child: const Icon(Icons.my_location)),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'report',
            backgroundColor: CS.vest,
            foregroundColor: CS.ink,
            onPressed: () {
              final c = _map.camera.center;
              push(ReportNewScreen(start: c));
            },
            icon: const Icon(Icons.add_location_alt),
            label: Text(t('nav.reportShort')),
          ),
        ]),
      ),
    ]);
    return widget.standalone ? Scaffold(appBar: AppBar(title: Text(t('nav.map'))), body: body) : body;
  }
}
