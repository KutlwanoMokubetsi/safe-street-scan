import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../ui/map.dart';
import '../ui/theme.dart';
import 'report_detail_screen.dart';

class ReportNewScreen extends StatefulWidget {
  const ReportNewScreen({super.key, this.start});
  final LatLng? start;
  @override
  State<ReportNewScreen> createState() => _ReportNewScreenState();
}

class _ReportNewScreenState extends State<ReportNewScreen> {
  final _map = MapController();
  bool _ready = false;
  (LatLng, double)? _pendingMove;

  /// Moving the map before it has been drawn throws, so early moves wait for onMapReady.
  void _moveTo(LatLng p, double zoom) {
    if (_ready) {
      _map.move(p, zoom);
    } else {
      _pendingMove = (p, zoom);
    }
  }

  void _onReady() {
    _ready = true;
    final m = _pendingMove;
    if (m != null) _map.move(m.$1, m.$2);
    _pendingMove = null;
  }
  final _form = GlobalKey<FormState>();
  final _desc = TextEditingController();
  final _place = TextEditingController();
  LatLng? _pin;
  String? _type;
  DateTime _when = DateTime.now();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _pin = widget.start;
    if (_pin == null) _useMyLocation();
  }

  Future<void> _useMyLocation() async {
    final p = await currentPosition();
    if (p == null) return;
    setState(() => _pin = LatLng(p.latitude, p.longitude));
    _moveTo(_pin!, 17);
  }

  Future<void> _pickTime() async {
    final d = await showDatePicker(context: context, initialDate: _when, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now());
    if (d == null || !mounted) return;
    final tm = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_when));
    if (tm == null) return;
    final picked = DateTime(d.year, d.month, d.day, tm.hour, tm.minute);
    setState(() => _when = picked.isAfter(DateTime.now()) ? DateTime.now() : picked);
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_pin == null) {
      snack(context, 'Tap the map to show where it happened.', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await Api.instance.post('/api/reports', {
        'crimeType': _type,
        'description': _desc.text.trim(),
        'locationName': _place.text.trim().isEmpty ? null : _place.text.trim(),
        'latitude': double.parse(_pin!.latitude.toStringAsFixed(6)),
        'longitude': double.parse(_pin!.longitude.toStringAsFixed(6)),
        'occurredAt': _when.toUtc().toIso8601String(),
      }) as Map<String, dynamic>;
      if (!mounted) return;
      snack(context, r['status'] == 'VERIFIED' ? 'Report sent and published.' : 'Report sent. A moderator will review it.');
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ReportDetailScreen(id: r.str('id'))));
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('nav.report'))),
      body: Form(
        key: _form,
        child: ListView(children: [
          Material(
            color: const Color(0xFFFDECEA),
            child: InkWell(
              onTap: () => launchUrl(Uri.parse('tel:10111')),
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Text('In danger right now? Call 10111 (SAPS) or 112 from a cellphone first.', style: TextStyle(color: Color(0xFF7A1F16))),
              ),
            ),
          ),
          SizedBox(
            height: 280,
            child: Stack(children: [
              FlutterMap(
                mapController: _map,
                options: MapOptions(initialCenter: _pin ?? defaultCenter, initialZoom: _pin == null ? 14 : 17, onTap: (_, p) => setState(() => _pin = p), onMapReady: _onReady),
                children: [
                  baseTiles(),
                  if (_pin != null)
                    MarkerLayer(markers: [
                      Marker(point: _pin!, width: 44, height: 44, alignment: Alignment.topCenter, child: const Icon(Icons.location_on, color: CS.vest, size: 44, shadows: [Shadow(color: Colors.black54, blurRadius: 4)])),
                    ]),
                  osmAttribution(),
                ],
              ),
              Positioned(right: 8, top: 8, child: FilledButton.tonalIcon(onPressed: _useMyLocation, icon: const Icon(Icons.my_location), label: const Text('My location'))),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(_pin == null ? 'Tap the map to drop a pin where it happened.' : 'Pin placed. Tap the map to move it.', style: const TextStyle(color: CS.muted)),
          ),
          Constrained(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(labelText: 'Type of incident'),
                  items: [for (final c in crimeTypes) DropdownMenuItem(value: c, child: Text(crimeLabel(c)))],
                  onChanged: (v) => setState(() => _type = v),
                  validator: (v) => v == null ? 'Choose the type of incident.' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _desc,
                  maxLines: 4,
                  maxLength: 2000,
                  decoration: const InputDecoration(labelText: 'What happened?', hintText: "Vehicle, clothing, direction of travel. Don't include anyone's name or ID number."),
                  validator: (v) => (v ?? '').trim().length < 10 ? 'Describe what happened in at least 10 characters.' : null,
                ),
                const SizedBox(height: 6),
                TextFormField(controller: _place, maxLength: 200, decoration: const InputDecoration(labelText: 'Place name (optional)', hintText: 'e.g. Corner of Jan Smuts and 7th Ave')),
                const SizedBox(height: 6),
                OutlinedButton.icon(onPressed: _pickTime, icon: const Icon(Icons.schedule),
                    label: Text('When: ${_when.day}/${_when.month} ${_when.hour.toString().padLeft(2, '0')}:${_when.minute.toString().padLeft(2, '0')}')),
                const SizedBox(height: 18),
                FilledButton(style: vestButton(), onPressed: _busy ? null : _submit, child: Text(_busy ? 'Sending…' : 'Send report')),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
