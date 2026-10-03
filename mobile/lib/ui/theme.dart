import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/config.dart';
import '../core/format.dart';

/// Brand colours (same as the web app): slate ink, hi-vis vest yellow, risk red, safe green.
class CS {
  static const ink = Color(0xFF17202B);
  static const inkSoft = Color(0xFF2A3542);
  static const vest = Color(0xFFF5C518);
  static const vestDeep = Color(0xFFD9AA00);
  static const risk = Color(0xFFC0392B);
  static const safe = Color(0xFF2E7D5B);
  static const amber = Color(0xFFD9822B);
  static const muted = Color(0xFF5E6873);
  static const line = Color(0xFFD8DDE1);
  static const surface = Color(0xFFF3F5F6);
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: CS.ink, brightness: b).copyWith(
    primary: dark ? CS.vest : CS.ink,
    onPrimary: dark ? CS.ink : Colors.white,
    secondary: CS.vest,
    onSecondary: CS.ink,
    error: CS.risk,
    surface: dark ? const Color(0xFF121820) : Colors.white,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: b);
  final body = GoogleFonts.barlowTextTheme(base.textTheme);
  TextStyle? head(TextStyle? s) => GoogleFonts.barlowSemiCondensed(textStyle: s, fontWeight: FontWeight.w700);
  return base.copyWith(
    scaffoldBackgroundColor: dark ? const Color(0xFF0E141B) : CS.surface,
    textTheme: body.copyWith(
      headlineLarge: head(body.headlineLarge),
      headlineMedium: head(body.headlineMedium),
      headlineSmall: head(body.headlineSmall),
      titleLarge: head(body.titleLarge),
      titleMedium: body.titleMedium?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: CS.ink,
      foregroundColor: Colors.white,
      titleTextStyle: GoogleFonts.barlowSemiCondensed(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: dark ? const Color(0xFF2A3542) : CS.line)),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)), textStyle: const TextStyle(fontWeight: FontWeight.w600))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)), textStyle: const TextStyle(fontWeight: FontWeight.w600))),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder(), isDense: false),
    navigationBarTheme: NavigationBarThemeData(indicatorColor: CS.vest.withValues(alpha: 0.45)),
  );
}

/// Yellow call-to-action (Report, Get started).
ButtonStyle vestButton() => FilledButton.styleFrom(backgroundColor: CS.vest, foregroundColor: CS.ink);
ButtonStyle dangerButton() => FilledButton.styleFrom(backgroundColor: CS.risk, foregroundColor: Colors.white);
ButtonStyle safeButton() => FilledButton.styleFrom(backgroundColor: CS.safe, foregroundColor: Colors.white);

void snack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? CS.risk : CS.ink, behavior: SnackBarBehavior.floating));
}

Future<bool> confirm(BuildContext context, String text, {String yes = 'OK'}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(content: Text(text), actions: [
      TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
      FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(yes)),
    ]),
  );
  return r == true;
}

/// Content width cap so tablets and landscape don't stretch text across the screen.
class Constrained extends StatelessWidget {
  const Constrained({super.key, required this.child, this.maxWidth = 720});
  final Widget child;
  final double maxWidth;
  @override
  Widget build(BuildContext context) =>
      Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child));
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.trailing, required this.child, this.padding = const EdgeInsets.all(16)});
  final String? title;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: padding,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (title != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Expanded(child: Text(title!, style: Theme.of(context).textTheme.titleLarge)),
                  if (trailing != null) trailing!,
                ]),
              ),
            child,
          ]),
        ),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.text, {super.key, this.action});
  final String text;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
        child: Column(children: [
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: CS.muted)),
          if (action != null) Padding(padding: const EdgeInsets.only(top: 12), child: action!),
        ]),
      );
}

class ErrorBox extends StatelessWidget {
  const ErrorBox(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Try again')),
        ]),
      );
}

class TypeTag extends StatelessWidget {
  const TypeTag(this.type, {super.key});
  final String? type;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 11, height: 11, decoration: BoxDecoration(color: crimeColor(type), borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Flexible(child: Text(crimeLabel(type), style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
      ]);
}

class StatusText extends StatelessWidget {
  const StatusText(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final (text, color) = switch (status) {
      'VERIFIED' => ('Verified', CS.safe),
      'REJECTED' => ('Not published', CS.risk),
      _ => ('Unverified', CS.amber),
    };
    return Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13));
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, this.url, required this.name, this.size = 40});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(RegExp(r'[\s@.]+')).where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: CS.inkSoft,
      foregroundImage: url == null ? null : NetworkImage('${Config.apiUrl}$url'),
      child: Text(initials.isEmpty ? '?' : initials, style: TextStyle(color: Colors.white, fontSize: size * 0.36, fontWeight: FontWeight.w600)),
    );
  }
}

class RiskMeter extends StatelessWidget {
  const RiskMeter(this.score, {super.key});
  final double score;
  @override
  Widget build(BuildContext context) {
    final r = riskLevel(score);
    return Semantics(
      label: 'Risk ${r.label}',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: LinearProgressIndicator(value: score.clamp(0.0, 1.0), minHeight: 6, color: r.color, backgroundColor: CS.line),
      ),
    );
  }
}

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.lines = 3});
  final int lines;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          for (var i = 0; i < lines; i++)
            Container(
              height: 12,
              margin: const EdgeInsets.only(bottom: 10),
              width: double.infinity,
              decoration: BoxDecoration(color: CS.line.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(6)),
            ),
        ]),
      );
}
