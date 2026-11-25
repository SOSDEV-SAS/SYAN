import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:immich_mobile/generated/codegen_loader.g.dart';

class SyanLocalizationLoader extends AssetLoader {
  const SyanLocalizationLoader();

  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async {
    final translations = await const CodegenLoader().load(path, locale);
    return _replaceBrand(translations) as Map<String, dynamic>;
  }

  dynamic _replaceBrand(dynamic value) {
    if (value is String) {
      return value.replaceAll('Immich', 'S&AN');
    }
    if (value is List) {
      return value.map(_replaceBrand).toList();
    }
    if (value is Map) {
      return value.map((key, item) => MapEntry(key, _replaceBrand(item)));
    }
    return value;
  }
}
