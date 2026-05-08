enum CelestialKind { comet, asteroid }

extension CelestialKindX on CelestialKind {
  String get id => name;
  String get displayName {
    switch (this) {
      case CelestialKind.comet:
        return 'Comets';
      case CelestialKind.asteroid:
        return 'Asteroids';
    }
  }

  String get apiParam {
    switch (this) {
      case CelestialKind.comet:
        return 'c';
      case CelestialKind.asteroid:
        return 'a';
    }
  }

  String get emoji {
    switch (this) {
      case CelestialKind.comet:
        return '☄';
      case CelestialKind.asteroid:
        return '◯';
    }
  }

  static CelestialKind fromId(String? raw) {
    if (raw == 'comet') return CelestialKind.comet;
    return CelestialKind.asteroid;
  }
}
