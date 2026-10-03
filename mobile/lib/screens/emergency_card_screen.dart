import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';

/// Medical details and an emergency contact, shown to friends only while your SOS is active.
class EmergencyCardScreen extends StatefulWidget {
  const EmergencyCardScreen({super.key});
  @override
  State<EmergencyCardScreen> createState() => _EmergencyCardScreenState();
}

class _EmergencyCardScreenState extends State<EmergencyCardScreen> {
  static const _fields = [
    ('allergies', 'card.allergies', 300), ('medications', 'card.medications', 300), ('conditions', 'card.conditions', 300),
    ('medicalAid', 'card.medicalAid', 80), ('medicalAidNumber', 'card.memberNo', 40),
    ('contactName', 'card.contactName', 80), ('contactRelation', 'card.relation', 40), ('contactPhone', 'card.phone', 30), ('notes', 'card.notes', 500),
  ];
  final _c = {for (final f in _fields) f.$1: TextEditingController()};
  String? _blood;
  bool _consent = false, _saved = false, _busy = false, _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await Api.instance.get('/api/me/emergency') as Map<String, dynamic>;
      final info = d['info'] as Map<String, dynamic>?;
      setState(() {
        if (info != null) {
          for (final f in _fields) {
            _c[f.$1]!.text = (info[f.$1] as String?) ?? '';
          }
          _blood = info['bloodType'] as String?;
          _saved = true;
        }
        _consent = d['consent'] == true;
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await Api.instance.put('/api/me/emergency', {
        'consent': true,
        'info': {'bloodType': _blood, for (final f in _fields) f.$1: _c[f.$1]!.text.trim().isEmpty ? null : _c[f.$1]!.text.trim()},
      });
      setState(() => _saved = true);
      if (mounted) snack(context, 'Saved.');
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    if (!await confirm(context, 'Delete your emergency card?', yes: 'Delete')) return;
    try {
      await Api.instance.delete('/api/me/emergency');
      setState(() { for (final c in _c.values) { c.clear(); } _blood = null; _consent = false; _saved = false; });
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('sos.card'))),
      body: _loading
          ? const Skeleton()
          : Constrained(
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Text(t('card.intro'), style: const TextStyle(color: CS.muted)),
                const SizedBox(height: 16),
                DropdownButtonFormField<String?>(
                  value: _blood,
                  decoration: InputDecoration(labelText: t('card.bloodType')),
                  items: [const DropdownMenuItem<String?>(value: null, child: Text('—')),
                    for (final b in const ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) DropdownMenuItem<String?>(value: b, child: Text(b))],
                  onChanged: (v) => setState(() => _blood = v),
                ),
                const SizedBox(height: 12),
                for (final f in _fields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: TextField(controller: _c[f.$1], maxLength: f.$3, maxLines: f.$3 > 100 ? 3 : 1, minLines: 1,
                        keyboardType: f.$1 == 'contactPhone' ? TextInputType.phone : TextInputType.text,
                        decoration: InputDecoration(labelText: t(f.$2))),
                  ),
                CheckboxListTile(contentPadding: EdgeInsets.zero, value: _consent, onChanged: (v) => setState(() => _consent = v ?? false),
                    title: Text(t('card.consent')), controlAffinity: ListTileControlAffinity.leading),
                const SizedBox(height: 8),
                FilledButton(onPressed: !_consent || _busy ? null : _save, child: Text(t('card.save'))),
                if (_saved) TextButton(onPressed: _delete, child: Text(t('card.delete'), style: const TextStyle(color: CS.risk))),
              ]),
            ),
    );
  }
}
