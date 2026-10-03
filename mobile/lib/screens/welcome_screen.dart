import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/auth.dart';
import '../core/config.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool _busy = false;

  Future<void> _go({bool google = false, bool register = false}) async {
    setState(() => _busy = true);
    try {
      await Auth.instance.signIn(google: google, register: register);
    } catch (e) {
      debugPrint('Sign-in failed: $e');
      if (mounted) {
        final cancelled = '$e'.toLowerCase().contains('cancel');
        // Show the real reason, so problems can be diagnosed from a screenshot.
        await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text(cancelled ? 'Sign-in cancelled' : "Couldn't sign in"),
            content: SingleChildScrollView(child: SelectableText(cancelled
                ? 'The sign-in page was closed before it finished. Try again.'
                : 'Details: $e')),
            actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('OK'))],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: CS.ink,
      body: SafeArea(
        child: Constrained(
          maxWidth: 520,
          child: ListView(padding: const EdgeInsets.fromLTRB(24, 24, 24, 32), children: [
            Row(children: [
              Image.asset('assets/icon_foreground.png', width: 40, semanticLabel: ''),
              const SizedBox(width: 6),
              Text('CrimeSpot', style: text.titleLarge?.copyWith(color: Colors.white)),
              const Spacer(),
              DropdownButton<String>(
                value: I18n.lang.value,
                dropdownColor: CS.inkSoft,
                underline: const SizedBox(),
                style: const TextStyle(color: Colors.white),
                iconEnabledColor: Colors.white,
                items: [for (final l in I18n.langs) DropdownMenuItem(value: l.$1, child: Text(l.$2))],
                onChanged: (l) => l == null ? null : I18n.set(l),
              ),
            ]),
            const SizedBox(height: 40),
            Text(t('welcome.headline'), style: text.headlineLarge?.copyWith(color: Colors.white, fontSize: 40, height: 1.05)),
            const SizedBox(height: 16),
            Text(t('welcome.lede'), style: text.bodyLarge?.copyWith(color: const Color(0xFFC9D1D9), height: 1.45)),
            const SizedBox(height: 36),
            FilledButton.icon(
              onPressed: _busy ? null : () => _go(google: true),
              style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: CS.ink),
              icon: const Text('G', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF4285F4), fontSize: 18)),
              label: Text(t('login.google')),
            ),
            const SizedBox(height: 10),
            FilledButton(onPressed: _busy ? null : () => _go(), style: vestButton(), child: Text(t('login.email'))),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _busy ? null : () => _go(register: true),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Color(0xFF4A5868))),
              child: Text(t('login.create')),
            ),
            const SizedBox(height: 28),
            Wrap(alignment: WrapAlignment.center, spacing: 16, children: [
              TextButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.webUrl}/privacy.html')), child: const Text('Privacy policy', style: TextStyle(color: Color(0xFFC9D1D9)))),
              TextButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.webUrl}/terms.html')), child: const Text('Terms of use', style: TextStyle(color: Color(0xFFC9D1D9)))),
            ]),
          ]),
        ),
      ),
    );
  }
}
