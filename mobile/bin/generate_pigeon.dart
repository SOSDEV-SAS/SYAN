import 'dart:io';

Future<void> main() async {
  final files = await Directory('pigeon')
      .list()
      .where((entry) => entry is File && entry.path.endsWith('.dart'))
      .map((entry) => entry.path)
      .toList();
  files.sort();

  for (final file in files) {
    final process = await Process.start(
      Platform.resolvedExecutable,
      ['run', 'pigeon', '--input', file],
      mode: ProcessStartMode.inheritStdio,
    );
    final exitCode = await process.exitCode;
    if (exitCode != 0) {
      throw ProcessException(
        Platform.resolvedExecutable,
        ['run', 'pigeon', '--input', file],
        'Pigeon generation failed',
        exitCode,
      );
    }
  }
}
