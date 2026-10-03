import 'dart:async';
import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/realtime.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'group_detail_screen.dart';

String kindLabel(String k) => k == 'ESTATE' ? 'Estate' : k == 'CPF' ? 'CPF' : 'Neighbourhood watch';

class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key});
  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  List<Map<String, dynamic>>? _groups;
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
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final g = await Api.instance.get('/api/groups');
      if (mounted) setState(() => _groups = (g as List).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _join() async {
    final code = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(t('groups.join')),
      content: TextField(controller: code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Invite code')),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Join'))],
    ));
    if (ok != true) return;
    try {
      final r = await Api.instance.post('/api/groups/join', {'code': code.text.trim()}) as Map<String, dynamic>;
      _load();
      push(GroupDetailScreen(id: r.str('id')));
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _create() async {
    final name = TextEditingController(), desc = TextEditingController();
    var kind = 'WATCH';
    var useHere = true;
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(t('groups.create')),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, maxLength: 80, decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Melville Neighbourhood Watch')),
        DropdownButtonFormField<String>(value: kind, decoration: const InputDecoration(labelText: 'Type'),
            items: const [DropdownMenuItem(value: 'WATCH', child: Text('Neighbourhood watch')), DropdownMenuItem(value: 'ESTATE', child: Text('Estate or complex')),
              DropdownMenuItem(value: 'CPF', child: Text('Community policing forum'))],
            onChanged: (v) => set(() => kind = v ?? 'WATCH')),
        TextField(controller: desc, maxLength: 500, maxLines: 2, decoration: const InputDecoration(labelText: 'Description (optional)')),
        CheckboxListTile(contentPadding: EdgeInsets.zero, value: useHere, onChanged: (v) => set(() => useHere = v ?? true),
            title: const Text("Use where I am now as the group's area")),
        const Text('Free for up to 100 members.', style: TextStyle(color: CS.muted)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Create group'))],
    )));
    if (ok != true || name.text.trim().isEmpty) return;
    final pos = useHere ? await currentPosition() : null;
    try {
      final r = await Api.instance.post('/api/groups', {'name': name.text.trim(), 'kind': kind, 'description': desc.text.trim().isEmpty ? null : desc.text.trim(),
        'lat': pos?.latitude, 'lng': pos?.longitude}) as Map<String, dynamic>;
      _load();
      push(GroupDetailScreen(id: r.str('id')));
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('groups.title'))),
      floatingActionButton: FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.group_add), label: Text(t('groups.create'))),
      body: _groups == null
          ? const Skeleton()
          : RefreshIndicator(
              onRefresh: _load,
              child: Constrained(
                child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 96), children: [
                  Text(t('groups.intro'), style: const TextStyle(color: CS.muted)),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(onPressed: _join, icon: const Icon(Icons.vpn_key_outlined), label: Text(t('groups.join'))),
                  const SizedBox(height: 12),
                  if (_groups!.isEmpty) const EmptyState("You're not in any groups yet. Create one for your street, estate or CPF, or join with a code."),
                  for (final g in _groups!)
                    Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        onTap: () => push(GroupDetailScreen(id: g.str('id'))),
                        leading: const Icon(Icons.groups, color: CS.ink),
                        title: Text(g.str('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${kindLabel(g.str('kind'))} · ${g.integer('members')} members · ${g.str('role').toLowerCase()}${g.flag('sosShare') ? ' · receives your SOS' : ''}'),
                        trailing: const Icon(Icons.chevron_right),
                      ),
                    ),
                ]),
              ),
            ),
    );
  }
}
