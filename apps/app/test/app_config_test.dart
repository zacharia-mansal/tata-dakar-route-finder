import 'package:flutter_test/flutter_test.dart';

import 'package:tata_route_finder/config/app_config.dart';

void main() {
  test('API_BASE_URL defaults to an empty string', () {
    expect(AppConfig.apiBaseUrl, isEmpty);
  });
}
