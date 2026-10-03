import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/map.dart';
import '../ui/theme.dart';

/// A friend's SOS: where they are, call them, directions, and their emergency card.
class AlertScreen extends StatefulWidget {
  const AlertScreen({super.key, required this.id});
  final String id;
  @override
  State<AlertScreen> createState() => _AlertScreenState();
}

class _AlertScreenState extends State<AlertScreen> {
  Map<String, dynamic>? _a;
  String? _error;
  Timer? _poll;
  StreamSubscription<String>? _sub;
  final _map = MapController();
  bool _centred = false;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _load());
    _sub = Realtime.instance.on({'live'}).listen((_) => _load());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final a = await Api.instance.get('/api/panic/${widget.id}') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _a = a);
      if (!_centred && a['latitude'] != null) {
        _centred = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          try { _map.move(LatLng(a.dbl('latitude'), a.dbl('longitude')), 16); } catch (_) {}
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _a;
    final active = a?['status'] == 'ACTIVE';
    final e = a?['emergency'] as Map<String, dynamic>?;
    return Scaffold(
      appBar: AppBar(title: Text(t('sos.title')), backgroundColor: active ? CS.risk : CS.safe),
      body: _error != null
          ? ErrorBox(_error!, onRetry: _load)
          : a == null
              ? const Skeleton()
              : ListView(children: [
                  Container(
                    color: active ? CS.risk : CS.safe,
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t(active ? 'alert.needsHelp' : 'alert.isSafe', {'name': a['name']}),
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white)),
                      const SizedBox(height: 6),
                      Text('Alert raised ${timeAgo(a.opt('createdAt'))}.${a['locationUpdatedAt'] != null ? ' Location updated ${timeAgo(a.opt('locationUpdatedAt'))}.' : ''}',
                          style: const TextStyle(color: Colors.white)),
                      if (a['message'] != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('"${a['message']}"', style: const TextStyle(color: Colors.white, fontSize: 16))),
                    ]),
                  ),
                  if (active)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Wrap(spacing: 8, runSpacing: 8, children: [
                        if (a['phone'] != null)
                          FilledButton.icon(onPressed: () => launchUrl(Uri.parse('tel:${a['phone']}')), icon: const Icon(Icons.call), label: Text(t('alert.call', {'name': a['name']}))),
                        if (a['latitude'] != null)
                          OutlinedButton.icon(
                            onPressed: () => launchUrl(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${a['latitude']},${a['longitude']}'), mode: LaunchMode.externalApplication),
                            icon: const Icon(Icons.directions), label: Text(t('alert.directions'))),
                        OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('tel:10111')), icon: const Icon(Icons.local_police, color: CS.risk), label: Text(t('alert.callPolice'))),
                      ]),
                    ),
                  if (active && e != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: SectionCard(
                        title: t('sos.card'),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          for (final (k, label) in [('bloodType', 'card.bloodType'), ('allergies', 'card.allergies'), ('medications', 'card.medications'),
                              ('conditions', 'card.conditions'), ('medicalAid', 'card.medicalAid'), ('notes', 'card.notes')])
                            if ((e[k] as String?)?.isNotEmpty == true)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Text.rich(TextSpan(children: [
                                  TextSpan(text: '${t(label)}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                                  TextSpan(text: k == 'medicalAid' && e['medicalAidNumber'] != null ? '${e[k]} · ${e['medicalAidNumber']}' : e[k] as String),
                                ])),
                              ),
                          if (e['contactName'] != null || e['contactPhone'] != null)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text('${t('card.contact')}: ${e['contactName'] ?? ''}${e['contactRelation'] != null ? ' (${e['contactRelation']})' : ''}'),
                              trailing: e['contactPhone'] == null ? null : IconButton(icon: const Icon(Icons.call), onPressed: () => launchUrl(Uri.parse('tel:${e['contactPhone']}'))),
                            ),
                        ]),
                      ),
                    ),
                  if (a['latitude'] != null)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          height: 360,
                          child: FlutterMap(
                            mapController: _map,
                            options: MapOptions(initialCenter: LatLng(a.dbl('latitude'), a.dbl('longitude')), initialZoom: 16),
                            children: [
                              baseTiles(),
                              if (a['accuracyM'] != null)
                                CircleLayer(circles: [CircleMarker(point: LatLng(a.dbl('latitude'), a.dbl('longitude')), radius: a.dbl('accuracyM'),
                                    useRadiusInMeter: true, color: (active ? CS.risk : CS.safe).withValues(alpha: 0.12))]),
                              MarkerLayer(markers: [Marker(point: LatLng(a.dbl('latitude'), a.dbl('longitude')), width: 26, height: 26, child: dot(active ? CS.risk : CS.safe, size: 24))]),
                              osmAttribution(),
                            ],
                          ),
                        ),
                      ),
                    )
                  else
                    const EmptyState('No location yet. Their phone may not have a GPS fix. Try calling them.'),
                ]),
    );
  }
}
