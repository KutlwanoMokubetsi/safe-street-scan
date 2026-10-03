import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'report_detail_screen.dart';
import 'report_new_screen.dart';

class MyReportsScreen extends StatefulWidget {
  const MyReportsScreen({super.key});
  @override
  State<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends State<MyReportsScreen> {
  List<Map<String, dynamic>>? _list;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.instance.get('/api/reports/mine');
      if (mounted) setState(() => _list = (r as List).cast<Map<String, dynamic>>());
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _delete(Map<String, dynamic> r) async {
    if (!await confirm(context, 'Delete this report? This can’t be undone.', yes: 'Delete')) return;
    try {
      await Api.instance.delete('/api/reports/${r['id']}');
      setState(() => _list!.remove(r));
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('nav.myReports'))),
      body: _error != null
          ? ErrorBox(_error!, onRetry: _load)
          : _list == null
              ? const Skeleton()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: Constrained(
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      const Text('Unverified reports still count toward hotspots, at a lower weight, until a moderator reviews them.', style: TextStyle(color: CS.muted)),
                      const SizedBox(height: 12),
                      if (_list!.isEmpty)
                        EmptyState("You haven't reported anything yet.",
                            action: FilledButton(style: vestButton(), onPressed: () => push(const ReportNewScreen()), child: Text(t('nav.report')))),
                      for (final r in _list!)
                        Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ListTile(
                            onTap: () => push(ReportDetailScreen(id: r.str('id'))),
                            title: Row(children: [Expanded(child: TypeTag(r.opt('crimeType'))), StatusText(r.str('status'))]),
                            subtitle: Text('${r.str('description')}\n${timeAgo(r.opt('occurredAt'))}', maxLines: 3, overflow: TextOverflow.ellipsis),
                            isThreeLine: true,
                            trailing: r['status'] == 'PENDING'
                                ? IconButton(tooltip: 'Delete', onPressed: () => _delete(r), icon: const Icon(Icons.delete_outline, color: CS.risk))
                                : null,
                          ),
                        ),
                    ]),
                  ),
                ),
    );
  }
}
