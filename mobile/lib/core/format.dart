import 'package:flutter/material.dart';
import 'i18n.dart';

const crimeTypes = ['ROBBERY', 'HIJACKING', 'ASSAULT', 'BURGLARY', 'THEFT', 'DRUG_RELATED', 'FRAUD', 'VANDALISM', 'SUSPICIOUS_ACTIVITY', 'OTHER'];

const _crimeColors = {
  'ROBBERY': Color(0xFFC0392B), 'HIJACKING': Color(0xFFA31F34), 'ASSAULT': Color(0xFFD9480F), 'BURGLARY': Color(0xFF7B4FA0),
  'THEFT': Color(0xFFD9822B), 'DRUG_RELATED': Color(0xFF3F5BA9), 'FRAUD': Color(0xFFB5487A), 'VANDALISM': Color(0xFF8A7A2B),
  'SUSPICIOUS_ACTIVITY': Color(0xFF2C7A8C), 'OTHER': Color(0xFF5E6873),
};

String crimeLabel(String? type) => t('crime.${type ?? 'OTHER'}');
Color crimeColor(String? type) => _crimeColors[type] ?? const Color(0xFF5E6873);

/// Three groups keep the map readable.
String severityOf(String? type) => switch (type) {
      'ASSAULT' || 'ROBBERY' || 'HIJACKING' => 'violent',
      'BURGLARY' || 'THEFT' || 'VANDALISM' || 'FRAUD' => 'property',
      _ => 'other',
    };
const severityColors = {'violent': Color(0xFFC0392B), 'property': Color(0xFFD9822B), 'other': Color(0xFF5E6873)};
const severityLabels = {'violent': 'Violent', 'property': 'Property', 'other': 'Other'};

({String label, Color color}) riskLevel(double score) {
  if (score >= 0.75) return (label: 'Very high', color: const Color(0xFFC0392B));
  if (score >= 0.5) return (label: 'High', color: const Color(0xFFD9480F));
  if (score >= 0.25) return (label: 'Moderate', color: const Color(0xFFD9822B));
  return (label: 'Low', color: const Color(0xFF2E7D5B));
}

String timeAgo(String? iso) {
  if (iso == null) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  final mins = DateTime.now().difference(d).inMinutes;
  if (mins < 1) return 'just now';
  if (mins < 60) return '$mins min ago';
  final hrs = (mins / 60).round();
  if (hrs < 24) return '$hrs h ago';
  final days = (hrs / 24).round();
  if (days < 30) return '$days d ago';
  return '${d.day}/${d.month}/${d.year}';
}

String hhmm(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

String km(num m) => m < 1000 ? '${m.round()} m' : '${(m / 1000).toStringAsFixed(1)} km';
String mins(num s) {
  final m = (s / 60).round();
  return m < 60 ? '$m min' : '${m ~/ 60} h ${m % 60} min';
}

/// Small helpers for reading JSON maps.
extension J on Map<String, dynamic> {
  String str(String k) => (this[k] ?? '').toString();
  String? opt(String k) => this[k]?.toString();
  double dbl(String k) => (this[k] as num?)?.toDouble() ?? 0;
  double? optDbl(String k) => (this[k] as num?)?.toDouble();
  int integer(String k) => (this[k] as num?)?.toInt() ?? 0;
  bool flag(String k) => this[k] == true;
  List<Map<String, dynamic>> list(String k) => ((this[k] as List?) ?? const []).cast<Map<String, dynamic>>();
  Map<String, dynamic>? obj(String k) => this[k] as Map<String, dynamic>?;
}
