import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/config.dart';
import '../core/geo.dart';
import '../core/i18n.dart';
import '../core/push.dart';
import '../ui/theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final _name = TextEditingController(text: Auth.instance.user.value?['fullName'] as String? ?? '');
  late final _phone = TextEditingController(text: Auth.instance.user.value?['phone'] as String? ?? '');
  bool _busy = false;

  Map<String, dynamic>? get _u => Auth.instance.user.value;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _patch(Map<String, dynamic> body, String done) async {
    setState(() => _busy = true);
    try {
      Auth.instance.user.value = await Api.instance.patch('/api/me', body) as Map<String, dynamic>;
      if (mounted) snack(context, done);
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _picture(ImageSource source) async {
    final x = await ImagePicker().pickImage(source: source, maxWidth: 1024, maxHeight: 1024, imageQuality: 85);
    if (x == null) return;
    final Uint8List bytes = await x.readAsBytes();
    final png = bytes.length > 4 && bytes[0] == 0x89 && bytes[1] == 0x50;
    try {
      await Api.instance.putBytes('/api/me/avatar', bytes, png ? 'image/png' : 'image/jpeg');
      await Auth.instance.loadUser();
      if (mounted) { setState(() {}); snack(context, 'Picture updated.'); }
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _setHome() async {
    final p = await currentPosition();
    if (p == null) {
      if (mounted) snack(context, 'Allow location access to set your home area.', error: true);
      return;
    }
    final radius = (_u?['alertRadiusM'] as int?) ?? 0;
    await _patch({'homeLatitude': p.latitude, 'homeLongitude': p.longitude, 'alertRadiusM': radius == 0 ? 2000 : radius}, 'Home area set.');
  }

  Future<void> _export() async {
    try {
      final bytes = await Api.instance.getBytes('/api/me/export');
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/crimespot-my-data.json');
      await f.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(f.path, mimeType: 'application/json')], subject: 'My CrimeSpot data');
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  Future<void> _deleteAccount() async {
    final typed = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(t('data.delete')),
      content: Column(mainAxisSize: MainAxisSize.min, children: [Text(t('data.deleteConfirm')), TextField(controller: typed, autocorrect: false)]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        FilledButton(style: dangerButton(), onPressed: () => Navigator.pop(c, typed.text.trim() == 'DELETE'), child: Text(t('data.delete'))),
      ],
    ));
    if (ok != true) return;
    try {
      await Push.instance.unregisterDevice();
      await Api.instance.delete('/api/me');
      await Auth.instance.signedOut();
    } catch (e) {
      if (mounted) snack(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = _u;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Constrained(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          SectionCard(
            child: Row(children: [
              Avatar(url: u?['avatarUrl'] as String?, name: (u?['fullName'] ?? u?['email'] ?? '?') as String, size: 76),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Profile picture', style: Theme.of(context).textTheme.titleMedium),
                const Text('Only you and your friends can see it.', style: TextStyle(color: CS.muted, fontSize: 13)),
                Wrap(spacing: 4, children: [
                  TextButton.icon(onPressed: () => _picture(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: const Text('Camera')),
                  TextButton.icon(onPressed: () => _picture(ImageSource.gallery), icon: const Icon(Icons.photo), label: const Text('Gallery')),
                  if (u?['avatarUrl'] != null)
                    TextButton(onPressed: () async { await Api.instance.delete('/api/me/avatar'); await Auth.instance.loadUser(); setState(() {}); },
                        child: const Text('Remove', style: TextStyle(color: CS.risk))),
                ]),
              ])),
            ]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'About you',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              TextField(controller: _name, maxLength: 120, decoration: const InputDecoration(labelText: 'Name', helperText: 'Friends see this name. Reports never show it.')),
              TextField(controller: _phone, maxLength: 30, keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone number', helperText: 'Only friends see this, so they can call you during an SOS.')),
              FilledButton(onPressed: _busy ? null : () => _patch({'fullName': _name.text, 'phone': _phone.text}, 'Profile saved.'), child: const Text('Save changes')),
            ]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: t('lang.title'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final l in I18n.langs) ChoiceChip(label: Text(l.$2), selected: I18n.lang.value == l.$1, onSelected: (_) => I18n.set(l.$1)),
              ]),
              if (I18n.lang.value != 'en') Padding(padding: const EdgeInsets.only(top: 8), child: Text(t('lang.note'), style: const TextStyle(color: CS.muted, fontSize: 13))),
            ]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Alerts near home',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('Get a notification when a verified incident is reported near your home.'),
              const SizedBox(height: 8),
              if (u?['hasHome'] == true) ...[
                DropdownButtonFormField<int>(
                  value: (u?['alertRadiusM'] as int?) ?? 0,
                  decoration: const InputDecoration(labelText: 'Alert me within'),
                  items: const [DropdownMenuItem(value: 0, child: Text('Off')), DropdownMenuItem(value: 1000, child: Text('1 km of home')),
                    DropdownMenuItem(value: 2000, child: Text('2 km of home')), DropdownMenuItem(value: 5000, child: Text('5 km of home'))],
                  onChanged: (v) => _patch({'alertRadiusM': v ?? 0}, 'Saved.'),
                ),
                TextButton(onPressed: _setHome, child: const Text('Update home to where I am now')),
                TextButton(onPressed: () => _patch({'clearHome': true}, 'Home removed.'), child: const Text('Remove home', style: TextStyle(color: CS.risk))),
              ] else
                FilledButton(style: vestButton(), onPressed: _busy ? null : _setHome, child: const Text("I'm at home: use my location")),
              const Text('Your home point is rounded to about 100 m and stored encrypted.', style: TextStyle(color: CS.muted, fontSize: 13)),
            ]),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Notifications',
            child: Text(Push.instance.enabled
                ? "On. You'll be alerted when a friend presses SOS. You can change this in Android settings."
                : 'This build was made without push notifications. Alerts still appear while CrimeSpot is open.'),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: t('data.title'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(t('data.intro'), style: const TextStyle(color: CS.muted)),
              const SizedBox(height: 8),
              OutlinedButton.icon(onPressed: _export, icon: const Icon(Icons.download), label: Text(t('data.download'))),
              const SizedBox(height: 8),
              OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: CS.risk), onPressed: _deleteAccount, child: Text(t('data.delete'))),
            ]),
          ),
          const SizedBox(height: 16),
          Text('Signed in as ${u?['email'] ?? ''}', style: const TextStyle(color: CS.muted)),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () async { await Push.instance.unregisterDevice(); await Auth.instance.signOut(); }, child: Text(t('app.signOut'))),
          Wrap(alignment: WrapAlignment.center, children: [
            TextButton(onPressed: () => launchUrl(Uri.parse('${Config.webUrl}/privacy.html')), child: const Text('Privacy policy')),
            TextButton(onPressed: () => launchUrl(Uri.parse('${Config.webUrl}/terms.html')), child: const Text('Terms of use')),
          ]),
        ]),
      ),
    );
  }
}
