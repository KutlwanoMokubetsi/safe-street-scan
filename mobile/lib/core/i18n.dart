import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'strings.dart';

/// App language: English, Afrikaans, isiZulu, isiXhosa. Missing translations fall back to English.
class I18n {
  static const langs = [('en', 'English', 'en-ZA'), ('af', 'Afrikaans', 'af-ZA'), ('zu', 'isiZulu', 'zu-ZA'), ('xh', 'isiXhosa', 'xh-ZA')];
  static final lang = ValueNotifier<String>('en');

  /// Called after a change so the account can be updated (notifications use the account's language).
  static void Function(String)? onChange;

  static Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    final saved = p.getString('lang');
    final device = PlatformDispatcher.instance.locale.languageCode;
    lang.value = saved ?? (langs.any((l) => l.$1 == device) ? device : 'en');
  }

  static Future<void> set(String l) async {
    lang.value = l;
    (await SharedPreferences.getInstance()).setString('lang', l);
    onChange?.call(l);
  }

  static String get speech => langs.firstWhere((l) => l.$1 == lang.value).$3;
}

int _idx(String l) => switch (l) { 'af' => 1, 'zu' => 2, 'xh' => 3, _ => 0 };

/// Translate a key; `{name}` placeholders are filled from [params].
String t(String key, [Map<String, Object?> params = const {}]) {
  final row = kStrings[key];
  var s = row == null ? key : (row[_idx(I18n.lang.value)].isNotEmpty ? row[_idx(I18n.lang.value)] : row[0]);
  params.forEach((k, v) => s = s.replaceAll('{$k}', '$v'));
  return s;
}
