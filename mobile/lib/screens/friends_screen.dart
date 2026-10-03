import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});
  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  Map<String, dynamic>? _data;
  final _code = TextEditingController();
  bool _busy = false;
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = Realtime.instance.on({'friends'}).listen((_) => _load());
  }

  @override
  void dispose() {
    _sub?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await Api.instance.get('/api/friends');
      if (mounted) setState(() => _data = d as Map<String, dynamic>);
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _act(Future<dynamic> Function() call, String done) async {
    try {
      await call();
      if (mounted) snack(context, done);
      _load();
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _add() async {
    setState(() => _busy = true);
    await _act(() => Api.instance.post('/api/friends/requests', {'code': _code.text.trim()}), 'Request sent.');
    _code.clear();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    final code = d?['myCode'] as String? ?? '········';
    return Scaffold(
      appBar: AppBar(title: Text(t('nav.friends'))),
      body: d == null
          ? const Skeleton()
          : RefreshIndicator(
              onRefresh: _load,
              child: Constrained(
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  const Text('Friends get your emergency alerts and can see your location when you choose to share it.', style: TextStyle(color: CS.muted)),
                  const SizedBox(height: 12),
                  SectionCard(
                    title: 'Your friend code',
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      SelectableText(code, style: Theme.of(context).textTheme.headlineMedium?.copyWith(letterSpacing: 4)),
                      const Text('Give this code to someone you trust so they can add you.', style: TextStyle(color: CS.muted)),
                      const SizedBox(height: 10),
                      Wrap(spacing: 8, children: [
                        OutlinedButton.icon(onPressed: () { Clipboard.setData(ClipboardData(text: code)); snack(context, 'Code copied.'); },
                            icon: const Icon(Icons.copy), label: const Text('Copy')),
                        FilledButton.icon(
                          onPressed: () => Share.share('Add me on CrimeSpot so we can look out for each other. My friend code is $code. ${Config.webUrl}'),
                          icon: const Icon(Icons.share), label: const Text('Share')),
                      ]),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'Add a friend',
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      TextField(controller: _code, textCapitalization: TextCapitalization.characters, maxLength: 12,
                          decoration: const InputDecoration(labelText: 'Their friend code', hintText: 'e.g. K7M2QX9P')),
                      FilledButton(onPressed: _busy ? null : _add, child: const Text('Send request')),
                    ]),
                  ),
                  if (d.list('incoming').isNotEmpty) ...[
                    const SizedBox(height: 16),
                    SectionCard(title: 'Requests for you', child: Column(children: [
                      for (final e in d.list('incoming'))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text((e['person'] as Map)['name'] as String),
                          trailing: Wrap(spacing: 4, children: [
                            TextButton(onPressed: () => _act(() => Api.instance.delete('/api/friends/${e['friendshipId']}'), 'Request declined.'), child: const Text('Decline')),
                            FilledButton(style: safeButton(), onPressed: () => _act(() => Api.instance.post('/api/friends/requests/${e['friendshipId']}/accept'), 'You are now friends.'), child: const Text('Accept')),
                          ]),
                        ),
                    ])),
                  ],
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'Your friends',
                    child: d.list('friends').isEmpty
                        ? const EmptyState('No friends yet. Share your code with family or neighbours you trust.')
                        : Column(children: [
                            for (final e in d.list('friends'))
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Avatar(url: (e['person'] as Map)['avatarUrl'] as String?, name: (e['person'] as Map)['name'] as String),
                                title: Text((e['person'] as Map)['name'] as String),
                                subtitle: (e['person'] as Map)['phone'] == null ? const Text('No phone number added') : null,
                                trailing: Wrap(spacing: 0, children: [
                                  if ((e['person'] as Map)['phone'] != null)
                                    IconButton(tooltip: 'Call', onPressed: () => launchUrl(Uri.parse('tel:${(e['person'] as Map)['phone']}')), icon: const Icon(Icons.call)),
                                  IconButton(
                                    tooltip: 'Remove',
                                    icon: const Icon(Icons.person_remove_outlined, color: CS.risk),
                                    onPressed: () async {
                                      final name = (e['person'] as Map)['name'];
                                      if (await confirm(context, "Remove $name? You'll stop seeing each other's location and alerts.", yes: 'Remove')) {
                                        _act(() => Api.instance.delete('/api/friends/${e['friendshipId']}'), '$name removed.');
                                      }
                                    },
                                  ),
                                ]),
                              ),
                          ]),
                  ),
                  if (d.list('outgoing').isNotEmpty) ...[
                    const SizedBox(height: 16),
                    SectionCard(title: 'Waiting for them', child: Column(children: [
                      for (final e in d.list('outgoing'))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text((e['person'] as Map)['name'] as String),
                          trailing: TextButton(onPressed: () => _act(() => Api.instance.delete('/api/friends/${e['friendshipId']}'), 'Request cancelled.'), child: const Text('Cancel')),
                        ),
                    ])),
                  ],
                ]),
              ),
            ),
    );
  }
}
