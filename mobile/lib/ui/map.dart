import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../core/config.dart';

/// Greyscale base map so reports and hotspots stand out (same look as the web app).
const _greyscale = ColorFilter.matrix(<double>[
  0.2126, 0.7152, 0.0722, 0, 8,
  0.2126, 0.7152, 0.0722, 0, 8,
  0.2126, 0.7152, 0.0722, 0, 8,
  0, 0, 0, 1, 0,
]);

TileLayer baseTiles() => TileLayer(
      urlTemplate: Config.tileUrl,
      userAgentPackageName: Config.userAgentPackage,
      maxZoom: 19,
      tileBuilder: (context, tileWidget, tile) => ColorFiltered(colorFilter: _greyscale, child: tileWidget),
    );

/// OpenStreetMap attribution (required by the tile usage policy).
Widget osmAttribution() => const Align(
      alignment: Alignment.bottomRight,
      child: Padding(
        padding: EdgeInsets.all(4),
        child: DecoratedBox(
          decoration: BoxDecoration(color: Color(0xB3FFFFFF)),
          child: Padding(padding: EdgeInsets.symmetric(horizontal: 4, vertical: 1), child: Text('© OpenStreetMap contributors', style: TextStyle(fontSize: 10, color: Colors.black87))),
        ),
      ),
    );

Widget dot(Color color, {double size = 16, bool hollow = false}) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: hollow ? Colors.white : color,
        shape: BoxShape.circle,
        border: Border.all(color: hollow ? color : Colors.white, width: hollow ? 3 : 2),
        boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 3)],
      ),
    );

Widget meDot() => dot(const Color(0xFF2F80ED), size: 18);
