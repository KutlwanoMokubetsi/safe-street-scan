import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'map_screen.dart';

class ReportDetailScreen extends StatefulWidget {
  const ReportDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends State<ReportDetailScreen> {
  Map<String, dynamic>? _r;
  List<Map<String, dynamic>> _comments = [];
  String? _error, _formError;
  final _body = TextEditingController();
  bool _busy = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 20), (_) => _loadComments());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _body.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await Api.instance.get('/api/reports/${widget.id}');
      if (mounted) setState(() => _r = r as Map<String, dynamic>);
      _loadComments();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _loadComments() async {
    try {
      final c = await Api.instance.get('/api/reports/${widget.id}/comments');
      if (mounted) setState(() => _comments = (c as List).cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _toggleSeen() async {
    final r = _r!;
    try {
      final res = r.flag('confirmedByMe')
          ? await Api.instance.delete('/api/reports/${widget.id}/confirm')
          : await Api.instance.post('/api/reports/${widget.id}/confirm');
      setState(() => _r = {...r, 'confirmedByMe': !r.flag('confirmedByMe'), 'confirmations': (res as Map)['confirmations']});
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _post() async {
    setState(() { _busy = true; _formError = null; });
    try {
      final res = await Api.instance.post('/api/reports/${widget.id}/comments', {'body': _body.text.trim()}) as Map<String, dynamic>;
      _body.clear();
      setState(() => _comments = [..._comments, res['comment'] as Map<String, dynamic>]);
      if (res['notice'] != null && mounted) snack(context, res['notice'] as String);
    } catch (e) {
      setState(() => _formError = '$e'); // e.g. "Please don't share phone numbers…"
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _flag(Map<String, dynamic> c) async {
    try {
      await Api.instance.post('/api/comments/${c['id']}/flag');
      setState(() => c['flaggedByMe'] = true);
      if (mounted) snack(context, 'Thanks. Moderators will take a look.');
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    if (!await confirm(context, 'Delete this comment?', yes: 'Delete')) return;
    try {
      await Api.instance.delete('/api/comments/${c['id']}');
      setState(() => _comments.remove(c));
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _r;
    return Scaffold(
      appBar: AppBar(title: const Text('Report')),
      body: _error != null
          ? ErrorBox(_error!, onRetry: _load)
          : r == null
              ? const Skeleton()
              : Constrained(
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    Card(
                      child: Container(
                        decoration: BoxDecoration(border: Border(left: BorderSide(color: crimeColor(r.opt('crimeType')), width: 5))),
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [Expanded(child: TypeTag(r.opt('crimeType'))), StatusText(r.str('status'))]),
                          const SizedBox(height: 10),
                          Text(r.str('description'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w400)),
                          const SizedBox(height: 6),
                          Text('${r.opt('locationName') ?? 'Pinned location'} · ${timeAgo(r.opt('occurredAt'))}', style: const TextStyle(color: CS.muted)),
                          if (r['source'] == 'NEWS' && r['sourceUrl'] != null)
                            TextButton(onPressed: () => launchUrl(Uri.parse(r.str('sourceUrl')), mode: LaunchMode.externalApplication),
                                child: Text('From the news, checked by a moderator: ${r.opt('sourceName') ?? 'source'}')),
                          if (r.flag('reporterTrusted')) Text('✓ ${t('seen.trusted')}', style: const TextStyle(color: CS.safe, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 10),
                          Wrap(spacing: 10, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                            if (!r.flag('mine') && r['status'] != 'REJECTED')
                              r.flag('confirmedByMe')
                                  ? FilledButton.icon(onPressed: _toggleSeen, icon: const Icon(Icons.visibility), label: Text(t('seen.button')))
                                  : OutlinedButton.icon(onPressed: _toggleSeen, icon: const Icon(Icons.visibility_outlined), label: Text(t('seen.button'))),
                            if (r.integer('confirmations') > 0) Text(t('seen.count', {'n': r.integer('confirmations')}), style: const TextStyle(color: CS.muted)),
                            OutlinedButton.icon(
                              onPressed: () => push(MapScreen(focus: LatLng(r.dbl('latitude'), r.dbl('longitude')), standalone: true)),
                              icon: const Icon(Icons.map_outlined), label: const Text('Show on map')),
                          ]),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SectionCard(
                      title: 'Comments',
                      trailing: Text('${_comments.length}', style: const TextStyle(color: CS.muted)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (_comments.isEmpty) const EmptyState('No comments yet. Add useful details, like what happened next or whether police responded.'),
                        for (final c in _comments)
                          Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: c.flag('hidden') ? const EdgeInsets.all(8) : EdgeInsets.zero,
                            color: c.flag('hidden') ? const Color(0xFFFFF6D6) : null,
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Container(
                                  padding: c['role'] == 'REPORTER' ? const EdgeInsets.symmetric(horizontal: 6) : EdgeInsets.zero,
                                  color: c['role'] == 'REPORTER' ? CS.vest : null,
                                  child: Text(c.str('author'), style: const TextStyle(fontWeight: FontWeight.w700, color: CS.ink)),
                                ),
                                const Spacer(),
                                Text(timeAgo(c.opt('createdAt')), style: const TextStyle(color: CS.muted, fontSize: 13)),
                              ]),
                              const SizedBox(height: 4),
                              Text(c.str('body')),
                              Row(children: [
                                if (c.flag('mine') || Auth.instance.canModerate)
                                  TextButton(onPressed: () => _delete(c), child: const Text('Delete', style: TextStyle(color: CS.risk))),
                                if (!c.flag('mine'))
                                  TextButton(onPressed: c.flag('flaggedByMe') ? null : () => _flag(c), child: Text(c.flag('flaggedByMe') ? 'Flagged' : 'Flag')),
                              ]),
                            ]),
                          ),
                        if (r['status'] != 'REJECTED') ...[
                          TextField(
                            controller: _body,
                            minLines: 2,
                            maxLines: 5,
                            maxLength: 1000,
                            decoration: InputDecoration(hintText: "Add a comment. You'll appear as an anonymous neighbour.", errorText: _formError, errorMaxLines: 3),
                          ),
                          const Text('No names, phone numbers or car registrations. Be kind.', style: TextStyle(color: CS.muted, fontSize: 13)),
                          const SizedBox(height: 8),
                          FilledButton(onPressed: _busy ? null : _post, child: Text(_busy ? 'Posting…' : 'Post')),
                        ],
                      ]),
                    ),
                  ]),
                ),
    );
  }
}
