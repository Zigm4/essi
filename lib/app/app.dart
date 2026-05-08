import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme.dart';

class UnderdeckApp extends ConsumerStatefulWidget {
  const UnderdeckApp({super.key});

  @override
  ConsumerState<UnderdeckApp> createState() => _UnderdeckAppState();
}

class _UnderdeckAppState extends ConsumerState<UnderdeckApp> {
  late final _router = buildRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Underdeck',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: _router,
    );
  }
}
