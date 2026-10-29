import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tata_route_finder/main.dart';

void main() {
  testWidgets('starts in French by default', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('Bienvenue'), findsOneWidget);
    expect(find.text('Français'), findsOneWidget);
    expect(find.text('Welcome'), findsNothing);
  });

  testWidgets('lets the user switch the interface to English in memory',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    final languageSelector = find.byType(DropdownButton<Locale>);
    expect(languageSelector, findsOneWidget);

    await tester.tap(languageSelector);
    await tester.pumpAndSettle();
    await tester.tap(find.text('English').last);
    await tester.pumpAndSettle();

    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Bienvenue'), findsNothing);
    expect(find.text('English'), findsOneWidget);
  });
}
