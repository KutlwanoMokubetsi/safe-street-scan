import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/auth.dart';
import '../core/config.dart';
import '../core/i18n.dart';
import '../ui/nav.dart';
import '../ui/theme.dart';
import 'emergency_card_screen.dart';
import 'fake_call_screen.dart';
import 'friends_screen.dart';
import 'groups_screen.dart';
import 'my_reports_screen.dart';
import 'profile_screen.dart';
import 'report_new_screen.dart';
import 'route_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String label, VoidCallback onTap, {String? sub}) => Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(leading: Icon(icon, color: CS.ink), title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: sub == null ? null : Text(sub), trailing: const Icon(Icons.chevron_right), onTap: onTap),
        );
    return ValueListenableBuilder(
      valueListenable: Auth.instance.user,
      builder: (context, u, _) => Constrained(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(url: u?['avatarUrl'] as String?, name: (u?['fullName'] ?? u?['email'] ?? '?') as String, size: 48),
            title: Text((u?['fullName'] ?? '') as String, style: Theme.of(context).textTheme.titleLarge),
            subtitle: Text((u?['email'] ?? '') as String),
            onTap: () => push(const ProfileScreen()),
          ),
          const SizedBox(height: 12),
          item(Icons.add_location_alt, t('nav.report'), () => push(const ReportNewScreen())),
          item(Icons.alt_route, t('nav.route'), () => push(const RouteScreen()), sub: t('route.intro')),
          item(Icons.people, t('nav.friends'), () => push(const FriendsScreen())),
          item(Icons.groups, t('nav.groups'), () => push(const GroupsScreen())),
          item(Icons.list_alt, t('nav.myReports'), () => push(const MyReportsScreen())),
          item(Icons.phone_in_talk, t('sos.fakeCall'), () => push(const FakeCallScreen()), sub: t('sos.fakeCallHint')),
          item(Icons.medical_information, t('sos.card'), () => push(const EmergencyCardScreen()), sub: t('sos.cardHint')),
          item(Icons.person, 'Profile', () => push(const ProfileScreen())),
          if (Auth.instance.canModerate)
            item(Icons.fact_check, t('nav.review'), () => launchUrl(Uri.parse('${Config.webUrl}/moderate'), mode: LaunchMode.externalApplication),
                sub: 'Opens the review queue in your browser'),
        ]),
      ),
    );
  }
}
