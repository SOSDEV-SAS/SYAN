import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:immich_mobile/generated/codegen_loader.g.dart';

class SyanLocalizationLoader extends AssetLoader {
  const SyanLocalizationLoader();

  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async {
    final translations = await const CodegenLoader().load(path, locale);
    return _replaceBrandMap(translations ?? const {});
  }

  Map<String, dynamic> _replaceBrandMap(Map<String, dynamic> values) => {
    for (final MapEntry(key: key, value: value) in values.entries)
      key: _replaceBrand(value),
  };

  dynamic _replaceBrand(dynamic value) {
    if (value is String) {
      return value.replaceAll('Immich', 'S&AN');
    }
    if (value is List) {
      return value.map(_replaceBrand).toList();
    }
    if (value is Map) {
      return _replaceBrandMap(Map<String, dynamic>.from(value));
    }
    return value;
  }
}
