import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_ringtone_player/flutter_ringtone_player.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:vibration/vibration.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';

/// A believable incoming call (the phone's own ringtone and vibration) to help someone leave a situation.
/// Answering plays a short spoken line in the chosen language.
class FakeCallScreen extends StatefulWidget {
  const FakeCallScreen({super.key});
  @override
  State<FakeCallScreen> createState() => _FakeCallScreenState();
}

enum _Phase { setup, waiting, ringing, talking }

class _FakeCallScreenState extends State<FakeCallScreen> {
  final _caller = TextEditingController(text: t('fake.defaultCaller'));
  final _tts = FlutterTts();
  _Phase _phase = _Phase.setup;
  int _delay = 10, _countdown = 0, _seconds = 0;
  Timer? _timer;

  @override
  void dispose() {
    _stopRinging();
    _timer?.cancel();
    _tts.stop();
    _caller.dispose();
    super.dispose();
  }

  void _schedule() {
    setState(() { _phase = _Phase.waiting; _countdown = _delay; });
    if (_delay == 0) {
      _ring();
      return;
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (tm) {
      setState(() => _countdown--);
      if (_countdown <= 0) { tm.cancel(); _ring(); }
    });
  }

  Future<void> _ring() async {
    setState(() => _phase = _Phase.ringing);
    FlutterRingtonePlayer().playRingtone(looping: true, asAlarm: false);
    if (await Vibration.hasVibrator() == true) Vibration.vibrate(pattern: [0, 800, 400, 800, 1000], repeat: 0);
  }

  void _stopRinging() {
    FlutterRingtonePlayer().stop();
    Vibration.cancel();
  }

  Future<void> _answer() async {
    _stopRinging();
    setState(() { _phase = _Phase.talking; _seconds = 0; });
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _seconds++));
    await _tts.setLanguage(I18n.speech);
    await _tts.setSpeechRate(0.45);
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (mounted && _phase == _Phase.talking) await _tts.speak(t('fake.script'));
  }

  void _reset() {
    _stopRinging();
    _timer?.cancel();
    _tts.stop();
    setState(() => _phase = _Phase.setup);
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == _Phase.ringing || _phase == _Phase.talking) return _callUi();
    return Scaffold(
      appBar: AppBar(title: Text(t('sos.fakeCall'))),
      body: Constrained(
        maxWidth: 520,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text(t('fake.intro')),
          const SizedBox(height: 16),
          TextField(controller: _caller, maxLength: 30, enabled: _phase == _Phase.setup, decoration: InputDecoration(labelText: t('fake.caller'))),
          Text(t('fake.when'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            for (final d in const [0, 10, 30, 60])
              ChoiceChip(label: Text(d == 0 ? t('fake.now') : d < 60 ? '$d s' : '1 min'), selected: _delay == d,
                  onSelected: _phase == _Phase.setup ? (_) => setState(() => _delay = d) : null),
          ]),
          const SizedBox(height: 20),
          if (_phase == _Phase.setup)
            FilledButton(onPressed: _schedule, child: Text(t('fake.start')))
          else ...[
            Center(child: Text(t('fake.ringingIn', {'n': _countdown}), style: Theme.of(context).textTheme.headlineSmall)),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: _reset, child: Text(t('common.cancel'))),
          ],
          const SizedBox(height: 12),
          const Text('Keep CrimeSpot open, or the screen on, until it rings.', style: TextStyle(color: CS.muted)),
        ]),
      ),
    );
  }

  Widget _callUi() {
    final clock = '${(_seconds ~/ 60).toString().padLeft(2, '0')}:${(_seconds % 60).toString().padLeft(2, '0')}';
    Widget round(Color c, IconData icon, String label, VoidCallback onTap) => Semantics(
          button: true,
          label: label,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Material(color: c, shape: const CircleBorder(), child: InkWell(customBorder: const CircleBorder(), onTap: onTap,
                child: Padding(padding: const EdgeInsets.all(20), child: Icon(icon, color: Colors.white, size: 34)))),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(color: Colors.white)),
          ]),
        );
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF2B3A4A), Color(0xFF121A23)])),
          child: SafeArea(
            child: Column(children: [
              const SizedBox(height: 40),
              Text(_phase == _Phase.ringing ? t('fake.incoming') : clock, style: const TextStyle(color: Color(0xFFC9D1D9), fontSize: 16)),
              const SizedBox(height: 24),
              CircleAvatar(radius: 56, backgroundColor: const Color(0xFF5E6873),
                  child: Text(_caller.text.isEmpty ? '?' : _caller.text[0].toUpperCase(), style: const TextStyle(fontSize: 44, color: Colors.white))),
              const SizedBox(height: 16),
              Text(_caller.text, style: const TextStyle(color: Colors.white, fontSize: 34)),
              Text(t('fake.mobile'), style: const TextStyle(color: Color(0xFFC9D1D9))),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.only(bottom: 48),
                child: _phase == _Phase.ringing
                    ? Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                        round(const Color(0xFFE5484D), Icons.call_end, t('fake.decline'), _reset),
                        round(const Color(0xFF30A46C), Icons.call, t('fake.accept'), _answer),
                      ])
                    : round(const Color(0xFFE5484D), Icons.call_end, t('fake.end'), _reset),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
