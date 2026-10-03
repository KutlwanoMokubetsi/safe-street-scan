import 'dart:async';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'report_detail_screen.dart';

class GroupDetailScreen extends StatefulWidget {
  const GroupDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<GroupDetailScreen> createState() => _GroupDetailScreenState();
}

class _GroupDetailScreenState extends State<GroupDetailScreen> {
  Map<String, dynamic>? _g;
  List<Map<String, dynamic>> _reports = [];
  final _body = TextEditingController();
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = Realtime.instance.on({'groups'}).listen((_) => _load());
  }

  @override
  void dispose() {
    _sub?.cancel();
    _body.dispose();
    super.dispose();
  }

  bool get _admin => const ['OWNER', 'ADMIN'].contains(_g?['myRole']);

  Future<void> _load() async {
    try {
      final g = await Api.instance.get('/api/groups/${widget.id}') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _g = g);
      if (g['areaLat'] != null) {
        final r = await Api.instance.get('/api/groups/${widget.id}/reports');
        if (mounted) setState(() => _reports = (r as List).cast<Map<String, dynamic>>());
      }
    } catch (e) {
      if (mounted) {
        snack(context, '$e', error: true);
        Navigator.pop(context);
      }
    }
  }

  Future<void> _do(Future<dynamic> Function() call, {bool pop = false}) async {
    try {
      await call();
      if (pop && mounted) {
        Navigator.pop(context);
      } else {
        _load();
      }
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _post(bool alert) async {
    if (_body.text.trim().isEmpty) return;
    if (alert && !await confirm(context, 'Send this as an alert? Every member gets a notification.', yes: 'Send alert')) return;
    await _do(() => Api.instance.post('/api/groups/${widget.id}/posts', {'body': _body.text.trim(), 'alert': alert}));
    _body.clear();
  }

  @override
  Widget build(BuildContext context) {
    final g = _g;
    final me = Auth.instance.userId;
    return Scaffold(
      appBar: AppBar(title: Text(g?.str('name') ?? t('groups.title'))),
      body: g == null
          ? const Skeleton()
          : RefreshIndicator(
              onRefresh: _load,
              child: Constrained(
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  if (g['description'] != null) Text(g.str('description'), style: const TextStyle(color: CS.muted)),
                  const SizedBox(height: 6),
                  Text('${g.list('members').length}${g.integer('memberCap') > 0 ? ' / ${g.integer('memberCap')}' : ''} members · invite code ${g.str('inviteCode')}'),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: () => Share.share('Join "${g.str('name')}" on CrimeSpot so we can look out for each other. Invite code: ${g.str('inviteCode')}. ${AppConfig.webUrl}'),
                    icon: const Icon(Icons.share), label: const Text('Invite people')),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'Feed',
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      TextField(controller: _body, minLines: 2, maxLines: 5, maxLength: 1000,
                          decoration: const InputDecoration(hintText: 'Share something with the group. No names, phone numbers or car registrations.')),
                      Wrap(spacing: 8, children: [
                        FilledButton(onPressed: () => _post(false), child: const Text('Post')),
                        if (_admin) FilledButton(style: dangerButton(), onPressed: () => _post(true), child: const Text('Send as alert')),
                      ]),
                      const SizedBox(height: 8),
                      if (g.list('posts').isEmpty) const EmptyState('No posts yet.'),
                      for (final p in g.list('posts'))
                        Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: p.flag('alert') ? const Color(0xFFFDECEA) : null,
                            border: Border(left: BorderSide(color: p.flag('alert') ? CS.risk : CS.line, width: 4)),
                          ),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              if (p.flag('alert')) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(Icons.warning_amber_rounded, color: CS.risk, size: 20)),
                              Expanded(child: Text(p.str('author'), style: const TextStyle(fontWeight: FontWeight.w700))),
                              Text(timeAgo(p.opt('createdAt')), style: const TextStyle(color: CS.muted, fontSize: 13)),
                            ]),
                            const SizedBox(height: 4),
                            Text(p.str('body')),
                            if (p.flag('mine') || _admin)
                              TextButton(
                                onPressed: () async {
                                  if (await confirm(context, 'Delete this post?', yes: 'Delete')) _do(() => Api.instance.delete('/api/groups/${widget.id}/posts/${p['id']}'));
                                },
                                child: const Text('Delete', style: TextStyle(color: CS.risk)),
                              ),
                          ]),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'SOS',
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      SwitchListTile(contentPadding: EdgeInsets.zero, value: g.flag('mySosShare'), title: Text(t('groups.sosShare')),
                          onChanged: (v) => _do(() => Api.instance.put('/api/groups/${widget.id}/sos', {'share': v}))),
                      Text(t('groups.sosShareNote'), style: const TextStyle(color: CS.muted, fontSize: 13)),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: "In the group's area",
                    child: g['areaLat'] == null
                        ? EmptyState('No area set.', action: _admin ? OutlinedButton(onPressed: () async {
                            final p = await currentPosition();
                            if (p != null) _do(() => Api.instance.patch('/api/groups/${widget.id}', {'lat': p.latitude, 'lng': p.longitude}));
                          }, child: const Text('Use where I am now')) : null)
                        : _reports.isEmpty
                            ? const EmptyState('No reports in this area in the last 14 days.')
                            : Column(children: [
                                for (final r in _reports)
                                  ListTile(contentPadding: EdgeInsets.zero, onTap: () => push(ReportDetailScreen(id: r.str('id'))),
                                      title: TypeTag(r.opt('crimeType')), subtitle: Text('${r.str('description')}\n${timeAgo(r.opt('occurredAt'))}', maxLines: 3)),
                              ]),
                  ),
                  const SizedBox(height: 16),
                  SectionCard(
                    title: 'Members',
                    child: Column(children: [
                      for (final m in g.list('members'))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Avatar(url: m.opt('avatarUrl'), name: m.str('name'), size: 36),
                          title: Text(m.str('name')),
                          subtitle: Text(m.str('role').toLowerCase()),
                          trailing: m['role'] == 'OWNER' || m['userId'] == me
                              ? null
                              : PopupMenuButton<String>(
                                  onSelected: (v) async {
                                    if (v == 'remove') {
                                      if (await confirm(context, 'Remove ${m['name']} from the group?', yes: 'Remove')) {
                                        _do(() => Api.instance.delete('/api/groups/${widget.id}/members/${m['userId']}'));
                                      }
                                    } else {
                                      _do(() => Api.instance.patch('/api/groups/${widget.id}/members/${m['userId']}', {'role': v}));
                                    }
                                  },
                                  itemBuilder: (_) => [
                                    if (g['myRole'] == 'OWNER') ...[
                                      const PopupMenuItem(value: 'ADMIN', child: Text('Make admin')),
                                      const PopupMenuItem(value: 'MEMBER', child: Text('Make member')),
                                      const PopupMenuItem(value: 'OWNER', child: Text('Make owner')),
                                    ],
                                    if (_admin) const PopupMenuItem(value: 'remove', child: Text('Remove')),
                                  ],
                                ),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  if (g['myRole'] == 'OWNER')
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(foregroundColor: CS.risk),
                      onPressed: () async {
                        if (await confirm(context, 'Delete this group for everyone? This can’t be undone.', yes: 'Delete')) {
                          _do(() => Api.instance.delete('/api/groups/${widget.id}'), pop: true);
                        }
                      },
                      child: const Text('Delete group'))
                  else
                    OutlinedButton(
                      onPressed: () async {
                        if (me != null && await confirm(context, 'Leave this group?', yes: 'Leave')) {
                          _do(() => Api.instance.delete('/api/groups/${widget.id}/members/$me'), pop: true);
                        }
                      },
                      child: const Text('Leave group')),
                ]),
              ),
            ),
    );
  }
}
