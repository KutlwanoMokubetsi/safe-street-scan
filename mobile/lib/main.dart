import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:quick_actions/quick_actions.dart';
import 'core/api.dart';
import 'core/auth.dart';
import 'core/i18n.dart';
import 'core/live.dart';
import 'core/push.dart';
import 'core/realtime.dart';
import 'screens/shell.dart';
import 'screens/sos_screen.dart';
import 'screens/welcome_screen.dart';
import 'ui/nav.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await I18n.load();
  await Push.instance.init();
  runApp(const CrimeSpotApp());
}

class CrimeSpotApp extends StatefulWidget {
  const CrimeSpotApp({super.key});
  @override
  State<CrimeSpotApp> createState() => _CrimeSpotAppState();
}

class _CrimeSpotAppState extends State<CrimeSpotApp> {
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    Push.instance.onOpen = openUrl;
    Auth.instance.signedIn.addListener(_onAuthChange);
    // Keep the account's language in step with the app, so notifications arrive in the same language.
    I18n.onChange = (l) async {
      try {
        final u = await Api.instance.patch('/api/me', {'lang': l});
        Auth.instance.user.value = u as Map<String, dynamic>;
      } catch (_) {}
    };
    // Long-press the app icon → SOS.
    const QuickActions().initialize((type) {
      if (type == 'sos') push(const SosScreen());
    });
    const QuickActions().setShortcutItems(const [ShortcutItem(type: 'sos', localizedTitle: 'SOS')]);
    _restore();
  }

  Future<void> _restore() async {
    await Auth.instance.restore();
    if (mounted) setState(() => _restoring = false);
    final pending = Push.instance.takePending();
    if (pending != null) WidgetsBinding.instance.addPostFrameCallback((_) => openUrl(pending));
  }

  void _onAuthChange() {
    if (Auth.instance.signedIn.value) {
      Realtime.instance.start();
      Live.instance.start();
      Push.instance.registerDevice();
      final u = Auth.instance.user.value;
      if (u != null && u['lang'] != I18n.lang.value) I18n.onChange?.call(I18n.lang.value);
    } else {
      Realtime.instance.stop();
      Live.instance.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: I18n.lang,
      builder: (context, lang, _) => MaterialApp(
        title: 'CrimeSpot',
        navigatorKey: navigatorKey,
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        home: _restoring
            ? const _Splash()
            : ValueListenableBuilder<bool>(
                valueListenable: Auth.instance.signedIn,
                builder: (context, signedIn, _) => signedIn ? const Shell() : const WelcomeScreen(),
              ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Scaffold(
          backgroundColor: CS.ink,
          body: Center(child: Image.asset('assets/icon_foreground.png', width: 140, semanticLabel: 'CrimeSpot')),
        ),
      );
}
