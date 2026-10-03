import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'report_detail_screen.dart';
import 'report_new_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _stats, _news;
  List<Map<String, dynamic>> _reports = [], _hotspots = [];
  String? _error;
  bool _loading = true;
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _loadNews();
    _sub = Realtime.instance.on({'reports', 'hotspots'}).listen((_) => _load(quiet: true));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load({bool quiet = false}) async {
    if (!quiet) setState(() => _loading = true);
    try {
      final r = await Future.wait([Api.instance.get('/api/stats'), Api.instance.get('/api/reports/recent', {'limit': '8'}), Api.instance.get('/api/hotspots')]);
      if (!mounted) return;
      setState(() {
        _stats = r[0] as Map<String, dynamic>;
        _reports = (r[1] as List).cast<Map<String, dynamic>>();
        _hotspots = (r[2] as List).cast<Map<String, dynamic>>().take(6).toList();
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _loadNews() async {
    final p = await currentPosition(timeout: const Duration(seconds: 6));
    try {
      final n = await Api.instance.get('/api/news', p == null ? null : {'lat': p.latitude.toStringAsFixed(3), 'lng': p.longitude.toStringAsFixed(3)});
      if (mounted) setState(() => _news = n as Map<String, dynamic>);
    } catch (_) {
      if (mounted) setState(() => _news = {'area': '', 'items': []});
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final first = (Auth.instance.user.value?['fullName'] as String? ?? '').split(' ').first;
    return RefreshIndicator(
      onRefresh: () async { await _load(quiet: true); await _loadNews(); },
      child: Constrained(
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
          Text(first.isEmpty ? 'Hi there' : 'Hi $first', style: text.headlineMedium),
          const Text("Here's what the community has reported recently.", style: TextStyle(color: CS.muted)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: FilledButton.icon(style: vestButton(), onPressed: () => push(const ReportNewScreen()), icon: const Icon(Icons.add_location_alt), label: Text(t('nav.reportShort')))),
            const SizedBox(width: 10),
            Expanded(child: OutlinedButton.icon(onPressed: () => switchTab?.call(1), icon: const Icon(Icons.map), label: Text(t('nav.map')))),
          ]),
          const SizedBox(height: 16),
          if (_error != null) ErrorBox(_error!, onRetry: _load),
          _statsGrid(),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Latest reports',
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: _loading
                ? const Skeleton()
                : _reports.isEmpty
                    ? EmptyState('No reports yet. If something happened near you, add it so others know.',
                        action: FilledButton(style: vestButton(), onPressed: () => push(const ReportNewScreen()), child: Text(t('nav.report'))))
                    : Column(children: [for (final r in _reports) _reportTile(r)]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Hotspots',
            trailing: const Text('Last 30 days', style: TextStyle(color: CS.muted, fontSize: 13)),
            child: _loading
                ? const Skeleton(lines: 2)
                : _hotspots.isEmpty
                    ? const EmptyState('No hotspots right now. A hotspot appears when 3 or more incidents happen close together.')
                    : Column(children: [for (final h in _hotspots) _hotspotTile(h)]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Local news${(_news?['area'] as String? ?? '').isNotEmpty ? ': ${_news!['area']}' : ''}',
            child: _news == null
                ? const Skeleton(lines: 2)
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if ((_news!['items'] as List).isEmpty) const EmptyState('No recent crime news found for this area.'),
                    for (final n in (_news!['items'] as List).cast<Map<String, dynamic>>())
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(n.str('title'), style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${n.str('source')} · ${timeAgo(n.opt('publishedAt'))}'),
                        onTap: () => launchUrl(Uri.parse(n.str('url')), mode: LaunchMode.externalApplication),
                      ),
                    const Text("Headlines from GDELT and Google News. CrimeSpot doesn't check news stories.", style: TextStyle(color: CS.muted, fontSize: 12)),
                  ]),
          ),
        ]),
      ),
    );
  }

  Widget _statsGrid() {
    final s = _stats;
    Widget cell(String n, String label) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(n, style: Theme.of(context).textTheme.headlineMedium),
              Text(label, style: const TextStyle(color: CS.muted, fontSize: 13)),
            ]),
          ),
        );
    return Card(
      child: Column(children: [
        Row(children: [cell('${s?['reportsLast7Days'] ?? '–'}', 'reports this week'), cell('${s?['activeHotspots'] ?? '–'}', 'active hotspots')]),
        const Divider(height: 1),
        Row(children: [cell('${s?['verifiedReports'] ?? '–'}', 'verified'), cell('${s?['totalReports'] ?? '–'}', 'in total')]),
      ]),
    );
  }

  Widget _reportTile(Map<String, dynamic> r) => InkWell(
        onTap: () => push(ReportDetailScreen(id: r.str('id'))),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 0, 10),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: crimeColor(r.opt('crimeType')), width: 4))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: TypeTag(r.opt('crimeType'))), StatusText(r.str('status'))]),
            const SizedBox(height: 4),
            Text(r.str('description'), maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('${r.opt('locationName') ?? 'Pinned location'} · ${timeAgo(r.opt('occurredAt'))}', style: const TextStyle(color: CS.muted, fontSize: 13)),
          ]),
        ),
      );

  Widget _hotspotTile(Map<String, dynamic> h) {
    final risk = riskLevel(h.optDbl('riskNow') ?? h.dbl('intensityScore'));
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(h.str('name'), style: const TextStyle(fontWeight: FontWeight.w700))),
          Text(risk.label, style: TextStyle(color: risk.color, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 6),
        RiskMeter(h.optDbl('riskNow') ?? h.dbl('intensityScore')),
        const SizedBox(height: 4),
        Wrap(spacing: 10, children: [
          Text('${h.integer('crimeCount')} incidents · mostly ${crimeLabel(h.opt('topCrimeType')).toLowerCase()}', style: const TextStyle(color: CS.muted, fontSize: 13)),
          if (h['trend'] == 'RISING') const Text('▲ Rising', style: TextStyle(color: CS.risk, fontWeight: FontWeight.w600, fontSize: 13)),
          if (h['trend'] == 'FALLING') const Text('▼ Falling', style: TextStyle(color: CS.safe, fontWeight: FontWeight.w600, fontSize: 13)),
          if (h['peakHours'] != null) Text('Most incidents ${h['peakHours']}', style: const TextStyle(color: CS.muted, fontSize: 13)),
        ]),
      ]),
    );
  }
}
