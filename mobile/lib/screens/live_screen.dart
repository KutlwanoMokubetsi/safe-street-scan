import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/live.dart';
import '../ui/map.dart';
import '../ui/theme.dart';

class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  final _map = MapController();
  List<Map<String, dynamic>> _friends = [];
  Set<String> _chosen = {};
  int? _minutes = 60;
  int? _checkIn;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  Future<void> _loadFriends() async {
    try {
      final d = await Api.instance.get('/api/friends') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _friends = d.list('friends');
        _chosen = {for (final f in _friends) (f['person'] as Map)['userId'] as String};
      });
    } catch (_) {}
  }

  Future<void> _run(Future<dynamic> Function() call, [String? done]) async {
    setState(() => _busy = true);
    try {
      await call();
      await Live.instance.refresh();
      if (done != null && mounted) snack(context, done);
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start() async {
    if (_checkIn != null && _minutes != null && _checkIn! > _minutes!) {
      snack(context, 'Choose a check-in time before sharing ends.', error: true);
      return;
    }
    if (!await ensureLocationPermission()) {
      if (mounted) snack(context, 'Allow location access so friends can see you.', error: true);
      return;
    }
    await _run(() => Api.instance.post('/api/location/share', {'minutes': _minutes, 'friendIds': _chosen.toList(), 'checkInMinutes': _checkIn}),
        t('live.sharing'));
    Live.instance.sendNow();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Live.instance,
      builder: (context, _) {
        final live = Live.instance;
        final share = live.myShare;
        final visible = live.friendsSharing.where((f) => f['latitude'] != null).toList();
        return LayoutBuilder(builder: (context, box) {
          final wide = box.maxWidth > 720;
          final map = SizedBox(
            height: wide ? null : 260,
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: visible.isEmpty ? defaultCenter : LatLng(visible.first.dbl('latitude'), visible.first.dbl('longitude')),
                initialZoom: 13,
              ),
              children: [
                baseTiles(),
                MarkerLayer(markers: [
                  for (final f in visible)
                    Marker(
                      point: LatLng(f.dbl('latitude'), f.dbl('longitude')),
                      width: 140, height: 56,
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: CS.ink, borderRadius: BorderRadius.circular(4)),
                          child: Text(f.str('name'), style: const TextStyle(color: Colors.white, fontSize: 12), overflow: TextOverflow.ellipsis),
                        ),
                        const SizedBox(height: 2),
                        dot(f['reason'] == 'PANIC' ? CS.risk : CS.ink, size: 18),
                      ]),
                    ),
                ]),
                osmAttribution(),
              ],
            ),
          );
          final panel = ListView(padding: const EdgeInsets.all(16), children: [
            Text(t('nav.live'), style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            if (share != null) _sharingCard(live, share) else _startCard(),
            const SizedBox(height: 16),
            _walkCard(live),
            const SizedBox(height: 16),
            SectionCard(
              title: 'Sharing with you',
              child: live.friendsSharing.isEmpty
                  ? const EmptyState('No one is sharing their location with you right now.')
                  : Column(children: [
                      for (final f in live.friendsSharing)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Avatar(url: f.opt('avatarUrl'), name: f.str('name'), size: 36),
                          title: Text(f.str('name') + (f['reason'] == 'PANIC' ? '  SOS' : '')),
                          subtitle: Text(f['updatedAt'] == null ? 'Waiting for location' : 'Updated ${timeAgo(f.opt('updatedAt'))}'),
                          trailing: f['phone'] == null ? null : IconButton(tooltip: 'Call', icon: const Icon(Icons.call), onPressed: () => launchUrl(Uri.parse('tel:${f['phone']}'))),
                          onTap: f['latitude'] == null ? null : () => _map.move(LatLng(f.dbl('latitude'), f.dbl('longitude')), 16),
                        ),
                    ]),
            ),
            const SizedBox(height: 8),
            const Text('Your location is sent while you share, even if CrimeSpot is in the background. Nothing is kept after you stop.',
                style: TextStyle(color: CS.muted, fontSize: 13)),
          ]);
          return wide ? Row(children: [SizedBox(width: 380, child: panel), Expanded(child: map)]) : Column(children: [map, Expanded(child: panel)]);
        });
      },
    );
  }

  Widget _sharingCard(Live live, Map<String, dynamic> share) {
    final due = share['checkinDueAt'] as String?;
    return SectionCard(
      title: "You're sharing",
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(share['expiresAt'] == null ? 'Until you stop.' : 'Until ${hhmm(share.opt('expiresAt'))}.'),
        if (due != null)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(10),
            color: const Color(0xFFFFF6D6),
            child: Text("Check in by ${hhmm(due)}. If you don't, your friends get an emergency alert automatically."),
          ),
        if (live.gpsError != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(live.gpsError!, style: const TextStyle(color: CS.risk))),
        if (live.lastSent != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Last sent ${hhmm(live.lastSent!.toIso8601String())}', style: const TextStyle(color: CS.muted))),
        const SizedBox(height: 10),
        if (due != null)
          FilledButton(style: safeButton(), onPressed: _busy ? null : () => _run(() => Api.instance.post('/api/location/checkin'), "Checked in. Your friends know you're safe."),
              child: Text(t('live.arrived'))),
        OutlinedButton(onPressed: _busy ? null : () => _run(() => Api.instance.delete('/api/location/share'), 'Stopped sharing your location.'), child: const Text('Stop sharing')),
      ]),
    );
  }

  Widget _startCard() {
    if (_friends.isEmpty) return const SectionCard(title: 'Share your location', child: Text('Add friends first, then you can share your location with them.'));
    Widget opt<T>(String label, T value, T group, ValueChanged<T?> onChanged) =>
        RadioListTile<T>(dense: true, contentPadding: EdgeInsets.zero, title: Text(label), value: value, groupValue: group, onChanged: onChanged);
    return SectionCard(
      title: 'Share your location',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('For how long', style: TextStyle(fontWeight: FontWeight.w600)),
        opt<int?>('1 hour', 60, _minutes, (v) => setState(() => _minutes = v)),
        opt<int?>('8 hours', 480, _minutes, (v) => setState(() => _minutes = v)),
        opt<int?>('Until I stop', null, _minutes, (v) => setState(() => _minutes = v)),
        const Text("Alert my friends if I don't check in", style: TextStyle(fontWeight: FontWeight.w600)),
        opt<int?>('No check-in', null, _checkIn, (v) => setState(() => _checkIn = v)),
        opt<int?>('Within 30 minutes', 30, _checkIn, (v) => setState(() => _checkIn = v)),
        opt<int?>('Within 1 hour', 60, _checkIn, (v) => setState(() => _checkIn = v)),
        opt<int?>('Within 2 hours', 120, _checkIn, (v) => setState(() => _checkIn = v)),
        const Text('With', style: TextStyle(fontWeight: FontWeight.w600)),
        for (final f in _friends)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text((f['person'] as Map)['name'] as String),
            value: _chosen.contains((f['person'] as Map)['userId']),
            onChanged: (v) => setState(() {
              final id = (f['person'] as Map)['userId'] as String;
              v == true ? _chosen.add(id) : _chosen.remove(id);
            }),
          ),
        const SizedBox(height: 8),
        FilledButton(onPressed: _busy || _chosen.isEmpty ? null : _start, child: const Text('Start sharing')),
      ]),
    );
  }

  Widget _walkCard(Live live) {
    final w = live.walk;
    return SectionCard(
      title: '🚶 ${t('walk.title')}',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (w != null && w['status'] == 'REQUESTED') ...[
          Text(t('walk.waiting', {'name': w['escortName']})),
          TextButton(onPressed: () => _run(() => Api.instance.post('/api/escort/${w['id']}/end')), child: Text(t('common.cancel'))),
        ] else if (w != null) ...[
          Text(t('walk.with', {'name': w['escortName']}), style: const TextStyle(color: CS.safe, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          FilledButton(style: safeButton(), onPressed: () => _run(() => Api.instance.post('/api/escort/${w['id']}/end')), child: Text(t('live.arrived'))),
        ] else ...[
          Text(t('walk.intro'), style: const TextStyle(color: CS.muted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final f in _friends)
              OutlinedButton(
                onPressed: () async {
                  await _run(() => Api.instance.post('/api/escort', {'friendId': (f['person'] as Map)['userId']}));
                  Live.instance.sendNow();
                },
                child: Text(t('walk.ask', {'name': (f['person'] as Map)['name']})),
              ),
          ]),
        ],
        for (final s in live.escorting)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: (s['stationary'] == true || s['lost'] == true) ? const Color(0xFFFFF1D6) : const Color(0xFFE8EEF8), borderRadius: BorderRadius.circular(8)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('walk.escorting', {'name': s['walkerName']}), style: const TextStyle(fontWeight: FontWeight.w700, color: CS.ink)),
              if (s['lost'] == true) Text(t('walk.lostEscort', {'name': s['walkerName']}), style: const TextStyle(color: CS.ink))
              else if (s['stationary'] == true) Text(t('walk.stillEscort', {'name': s['walkerName']}), style: const TextStyle(color: CS.ink)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                FilledButton(
                  style: dangerButton(),
                  onPressed: () async {
                    if (await confirm(context, t('walk.raiseConfirm', {'name': s['walkerName']}), yes: 'Send alert')) {
                      _run(() => Api.instance.post('/api/escort/${s['id']}/alert'));
                    }
                  },
                  child: Text(t('walk.raise', {'name': s['walkerName']})),
                ),
                OutlinedButton(onPressed: () => _run(() => Api.instance.post('/api/escort/${s['id']}/end')), child: Text(t('walk.end'))),
              ]),
            ]),
          ),
      ]),
    );
  }
}
