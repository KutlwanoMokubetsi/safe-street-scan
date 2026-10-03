import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/i18n.dart';
import '../core/live.dart';
import '../core/realtime.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'alert_screen.dart';
import 'home_screen.dart';
import 'live_screen.dart';
import 'map_screen.dart';
import 'more_screen.dart';
import 'sos_screen.dart';

/// Bottom navigation (Home, Map, SOS, Live, More) with urgent banners above every tab.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    switchTab = (i) {
      if (i == 2) {
        push(const SosScreen());
      } else {
        setState(() => _tab = i);
      }
    };
    Realtime.instance.notices.listen((text) {
      if (mounted && text.isNotEmpty) snack(context, text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          const _Banners(),
          Expanded(
            child: IndexedStack(index: _tab == 2 ? 0 : _tab, children: const [
              HomeScreen(),
              MapScreen(),
              SizedBox(),
              LiveScreen(),
              MoreScreen(),
            ]),
          ),
        ]),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => switchTab?.call(i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: t('app.home')),
          NavigationDestination(icon: const Icon(Icons.map_outlined), selectedIcon: const Icon(Icons.map), label: t('nav.map')),
          NavigationDestination(
            icon: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(color: CS.risk, borderRadius: BorderRadius.circular(18)),
              child: const Text('SOS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 1)),
            ),
            label: 'SOS',
          ),
          NavigationDestination(icon: const Icon(Icons.share_location_outlined), selectedIcon: const Icon(Icons.share_location), label: t('nav.live')),
          NavigationDestination(icon: const Icon(Icons.menu), label: t('app.more')),
        ],
      ),
    );
  }
}

class _Banners extends StatelessWidget {
  const _Banners();

  /// A banner: message, then actions. On narrow screens or large text the actions move under the message.
  Widget _bar(Color bg, Color fg, List<Widget> children, {VoidCallback? onTap}) => Material(
        color: bg,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: DefaultTextStyle.merge(
              style: TextStyle(color: fg),
              child: LayoutBuilder(builder: (context, box) {
                final message = children.whereType<Expanded>().toList();
                final actions = children.where((w) => w is! Expanded).toList();
                final scale = MediaQuery.textScalerOf(context).scale(1);
                if (box.maxWidth >= 480 && scale <= 1.15) return Row(children: children);
                return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  for (final m in message) m.child,
                  if (actions.isNotEmpty) Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: actions),
                  ),
                ]);
              }),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([Live.instance, Api.instance.serverDown]),
      builder: (context, _) {
        final live = Live.instance;
        final out = <Widget>[];
        if (Api.instance.serverDown.value) {
          out.add(_bar(const Color(0xFF7A1F16), Colors.white, [Expanded(child: Text(t('common.apiDown')))]));
        }
        for (final a in live.friendAlerts) {
          out.add(_bar(CS.risk, Colors.white, [
            Expanded(child: Text('${t('alert.needsHelp', {'name': a['name']})}. ${t('alert.tapToSee')}', style: const TextStyle(fontWeight: FontWeight.w600))),
            const Icon(Icons.chevron_right, color: Colors.white),
          ], onTap: () => push(AlertScreen(id: a['id'] as String))));
        }
        for (final w in live.walkRequests) {
          out.add(_bar(const Color(0xFFE8EEF8), const Color(0xFF1D3557), [
            Expanded(child: Text(t('walk.incoming', {'name': w['walkerName']}))),
            TextButton(onPressed: () => _walk(context, w['id'] as String, 'decline'), child: Text(t('walk.decline'))),
            FilledButton(onPressed: () => _walk(context, w['id'] as String, 'accept'), child: Text(t('walk.accept'))),
          ]));
        }
        final mine = live.walk;
        if (mine != null && mine['status'] == 'ACTIVE' && mine['stationary'] == true) {
          out.add(_bar(const Color(0xFFFFF1D6), const Color(0xFF6B4500), [
            Expanded(child: Text(t('walk.still', {'name': mine['escortName']}))),
            FilledButton(onPressed: () => _walk(context, mine['id'] as String, 'ok'), child: Text(t('walk.ok'))),
          ]));
        }
        for (final s in live.escorting.where((s) => s['stationary'] == true || s['lost'] == true)) {
          out.add(_bar(const Color(0xFFFFF1D6), const Color(0xFF6B4500), [
            Expanded(child: Text(t(s['lost'] == true ? 'walk.lostEscort' : 'walk.stillEscort', {'name': s['walkerName']}),
                style: const TextStyle(fontWeight: FontWeight.w700))),
          ], onTap: () => switchTab?.call(3)));
        }
        if (live.sharing) {
          final share = live.myShare;
          final due = share?['checkinDueAt'] as String?;
          out.add(_bar(live.myAlert != null ? const Color(0xFFFDECEA) : const Color(0xFFE8F3EE),
              live.myAlert != null ? const Color(0xFF7A1F16) : const Color(0xFF1E5A41), [
            Expanded(child: Row(children: [
              const Icon(Icons.circle, size: 10),
              const SizedBox(width: 8),
              Expanded(child: Text(live.myAlert != null ? t('live.emergencyActive') : t('live.sharing'))),
            ])),
            if (live.myAlert != null)
              TextButton(onPressed: () => push(const SosScreen()), child: Text(t('live.view')))
            else if (due != null)
              FilledButton(style: safeButton(), onPressed: () => _checkIn(context), child: Text(t('live.arrived')))
            else
              TextButton(onPressed: () => _stop(context), child: Text(t('live.stop'))),
          ]));
        }
        if (out.isEmpty) return const SizedBox.shrink();
        // Urgent banners never take more than a third of the screen; with many, they scroll in place.
        return ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.34),
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: out)),
        );
      },
    );
  }

  Future<void> _walk(BuildContext context, String id, String action) async {
    try {
      await Api.instance.post('/api/escort/$id/$action');
      Live.instance.refresh();
    } catch (e) {
      if (context.mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _checkIn(BuildContext context) async {
    try {
      await Api.instance.post('/api/location/checkin');
      Live.instance.refresh();
    } catch (e) {
      if (context.mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _stop(BuildContext context) async {
    try {
      await Api.instance.delete('/api/location/share');
      Live.instance.refresh();
    } catch (e) {
      if (context.mounted) snack(context, '$e', error: true);
    }
  }
}
