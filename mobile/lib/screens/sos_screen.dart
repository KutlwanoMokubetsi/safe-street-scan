import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import '../core/api.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/live.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'emergency_card_screen.dart';
import 'fake_call_screen.dart';
import 'friends_screen.dart';

/// Hold for 3 seconds to alert every friend (and opted-in groups) with your live location.
class SosScreen extends StatefulWidget {
  const SosScreen({super.key});
  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _hold = AnimationController(vsync: this, duration: const Duration(seconds: 3));
  final _message = TextEditingController();
  bool _sending = false;
  int? _friendCount;
  List<Map<String, String>> _contacts = [];
  String? _smsLink;

  @override
  void initState() {
    super.initState();
    _hold.addStatusListener((s) {
      if (s == AnimationStatus.completed) _fire();
    });
    _hold.addListener(() {
      // A light tick each second while holding.
      final v = _hold.value;
      if ((v * 3).floor() != ((v - 0.02) * 3).floor() && v < 1) HapticFeedback.mediumImpact();
    });
    _loadContacts();
    Live.instance.refresh();
  }

  @override
  void dispose() {
    _hold.dispose();
    _message.dispose();
    super.dispose();
  }

  /// Friends with phone numbers, saved on the phone so the SMS fallback works offline.
  Future<void> _loadContacts() async {
    final p = await SharedPreferences.getInstance();
    final cached = p.getString('sosContacts');
    if (cached != null) _contacts = (jsonDecode(cached) as List).map((e) => Map<String, String>.from(e as Map)).toList();
    try {
      final d = await Api.instance.get('/api/friends') as Map<String, dynamic>;
      final friends = (d['friends'] as List).cast<Map<String, dynamic>>();
      _contacts = [
        for (final f in friends)
          if ((f['person'] as Map)['phone'] != null) {'name': (f['person'] as Map)['name'] as String, 'phone': (f['person'] as Map)['phone'] as String},
      ];
      await p.setString('sosContacts', jsonEncode(_contacts));
      if (mounted) setState(() => _friendCount = friends.length);
    } catch (_) {}
  }

  Future<void> _fire() async {
    setState(() => _sending = true);
    HapticFeedback.heavyImpact();
    // Don't hold the alert back for GPS: wait at most 4 seconds.
    final pos = await currentPosition(timeout: const Duration(seconds: 4));
    try {
      await Api.instance.post('/api/panic', {
        'latitude': pos?.latitude, 'longitude': pos?.longitude, 'accuracyM': pos?.accuracy.round(),
        'message': _message.text.trim().isEmpty ? null : _message.text.trim(),
      });
      await Live.instance.refresh();
      HapticFeedback.heavyImpact();
    } catch (e) {
      if (mounted) snack(context, '$e Call 10111 now.', error: true);
      _buildSms(pos?.latitude, pos?.longitude);
    } finally {
      _hold.reset();
      if (mounted) setState(() => _sending = false);
    }
  }

  void _buildSms(double? lat, double? lng) {
    final phones = _contacts.map((c) => c['phone']!.replaceAll(RegExp(r'[^+0-9]'), '')).toList();
    if (phones.isEmpty) return;
    final where = lat == null ? '' : " I'm here: https://maps.google.com/?q=${lat.toStringAsFixed(5)},${lng!.toStringAsFixed(5)}";
    final extra = _message.text.trim().isEmpty ? '' : ' ${_message.text.trim()}';
    final body = 'EMERGENCY: I need help.$extra$where (sent from CrimeSpot)';
    setState(() => _smsLink = 'sms:${phones.join(',')}?body=${Uri.encodeComponent(body)}');
  }

  Future<void> _safe(String id) async {
    if (!await confirm(context, t('sos.confirmSafe'), yes: t('sos.safe'))) return;
    try {
      await Api.instance.post('/api/panic/$id/resolve');
      await Live.instance.refresh();
      if (mounted) snack(context, 'Alert ended. Your friends know you are safe.');
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Widget _calls() => Row(children: [
        for (final c in [('10111', t('sos.police')), ('112', t('sos.cell')), ('10177', t('sos.ambulance'))])
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: OutlinedButton(
                onPressed: () => launchUrl(Uri.parse('tel:${c.$1}')),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                child: Column(children: [
                  Text(c.$1, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  Text(c.$2, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w400)),
                ]),
              ),
            ),
          ),
      ]);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('sos.title')), backgroundColor: CS.risk),
      body: ListenableBuilder(
        listenable: Live.instance,
        builder: (context, _) {
          final alert = Live.instance.myAlert;
          return Constrained(
            maxWidth: 560,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (alert != null) ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: CS.risk, borderRadius: BorderRadius.circular(12)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t('sos.sent'), style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white)),
                    const SizedBox(height: 6),
                    Text(t('sos.sentText'), style: const TextStyle(color: Colors.white)),
                    if (Live.instance.gpsError != null) Text(Live.instance.gpsError!, style: const TextStyle(color: Colors.white)),
                  ]),
                ),
                const SizedBox(height: 16),
                _calls(),
                const SizedBox(height: 16),
                FilledButton(style: safeButton(), onPressed: () => _safe(alert['id'] as String), child: Text(t('sos.safe'))),
              ] else ...[
                Text(t('sos.intro')),
                if (_friendCount == 0)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(12),
                    color: const Color(0xFFFFF6D6),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t('sos.noFriends'), style: const TextStyle(color: CS.ink)),
                      TextButton(onPressed: () => push(const FriendsScreen()), child: Text(t('sos.addFriends'))),
                    ]),
                  ),
                const SizedBox(height: 24),
                Center(
                  child: Semantics(
                    button: true,
                    label: '${t('sos.hold')}. ${t('sos.letGo')}',
                    child: GestureDetector(
                      onLongPressStart: _sending ? null : (_) => _hold.forward(from: 0),
                      onLongPressEnd: (_) { if (!_hold.isCompleted) _hold.reverse(); },
                      onLongPressCancel: () { if (!_hold.isCompleted) _hold.reverse(); },
                      onTap: () => snack(context, t('sos.intro')),
                      child: AnimatedBuilder(
                        animation: _hold,
                        builder: (context, _) => SizedBox(
                          width: 240, height: 240,
                          child: Stack(alignment: Alignment.center, children: [
                            SizedBox.expand(child: CircularProgressIndicator(value: _hold.value, strokeWidth: 12, color: CS.ink, backgroundColor: CS.risk.withValues(alpha: 0.2))),
                            Container(
                              width: 204, height: 204,
                              decoration: const BoxDecoration(color: CS.risk, shape: BoxShape.circle),
                              alignment: Alignment.center,
                              padding: const EdgeInsets.all(20),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 164),
                                  child: Text(
                                    _sending ? t('sos.sending') : _hold.value > 0 ? t('sos.keepHolding') : t('sos.hold'),
                                    textAlign: TextAlign.center,
                                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white),
                                  ),
                                ),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Center(child: Text(t('sos.letGo'), style: const TextStyle(color: CS.muted))),
                if (_smsLink != null)
                  Container(
                    margin: const EdgeInsets.only(top: 16),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFFFDECEA), borderRadius: BorderRadius.circular(8)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(t('sos.failed'), style: const TextStyle(fontWeight: FontWeight.w700, color: CS.ink)),
                      const SizedBox(height: 8),
                      FilledButton(onPressed: () => launchUrl(Uri.parse(_smsLink!)), child: Text('${t('sos.sendSms')} (${_contacts.length})')),
                    ]),
                  ),
                const SizedBox(height: 16),
                TextField(controller: _message, maxLength: 280, decoration: InputDecoration(labelText: t('sos.message'))),
                const SizedBox(height: 8),
                _calls(),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: _tool(t('sos.fakeCall'), t('sos.fakeCallHint'), Icons.phone_in_talk, () => push(const FakeCallScreen()))),
                  const SizedBox(width: 8),
                  Expanded(child: _tool(t('sos.card'), t('sos.cardHint'), Icons.medical_information, () => push(const EmergencyCardScreen()))),
                ]),
              ],
            ]),
          );
        },
      ),
    );
  }

  Widget _tool(String title, String hint, IconData icon, VoidCallback onTap) => Material(
        color: CS.ink,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: CS.vest),
              const SizedBox(height: 6),
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              Text(hint, style: const TextStyle(color: Color(0xFFC9D1D9), fontSize: 12)),
            ]),
          ),
        ),
      );
}
