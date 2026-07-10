import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/database/app_database.dart';

/// Stable entity-kind keys for the generic [Favorites] table. Kept as string
/// constants (not an enum) so persisted/exported rows stay valid even if the
/// set of kinds grows later.
abstract final class FavoriteKind {
  static const job = 'job';
  static const kbArticle = 'kb_article';
  static const fishingZone = 'fishing_zone';
  static const trackedObject = 'tracked_object';
}

/// Reactive store for star/pin/bookmark across entity kinds. All reads go
/// through drift `watch()` so the UI updates live as favorites toggle.
class FavoritesRepository {
  FavoritesRepository(this._db);
  final AppDatabase _db;

  /// Live set of favorited ids for a single [kind].
  Stream<Set<String>> watchIds(String kind) {
    final q = _db.select(_db.favorites)
      ..where((f) => f.entityType.equals(kind));
    return q.watch().map((rows) => rows.map((r) => r.entityId).toSet());
  }

  /// Live favorite flag for one entity.
  Stream<bool> watchIsFavorite(String kind, String id) {
    final q = _db.select(_db.favorites)
      ..where((f) => f.entityType.equals(kind) & f.entityId.equals(id));
    return q.watch().map((rows) => rows.isNotEmpty);
  }

  Future<bool> isFavorite(String kind, String id) async {
    final row = await (_db.select(_db.favorites)
          ..where((f) => f.entityType.equals(kind) & f.entityId.equals(id)))
        .getSingleOrNull();
    return row != null;
  }

  /// Flip the favorite flag for one entity. Returns the new state.
  Future<bool> toggle(String kind, String id) async {
    if (await isFavorite(kind, id)) {
      await (_db.delete(_db.favorites)
            ..where((f) => f.entityType.equals(kind) & f.entityId.equals(id)))
          .go();
      return false;
    }
    await _db.into(_db.favorites).insert(
          FavoritesCompanion.insert(
            entityType: kind,
            entityId: id,
            createdAt: DateTime.now(),
          ),
          mode: InsertMode.insertOrReplace,
        );
    return true;
  }
}

final favoritesRepositoryProvider = Provider<FavoritesRepository>((ref) {
  return FavoritesRepository(ref.watch(appDatabaseProvider));
});

/// Live favorited-id set for a given [FavoriteKind]. Family key is the kind.
final favoriteIdsProvider =
    StreamProvider.family<Set<String>, String>((ref, kind) {
  return ref.watch(favoritesRepositoryProvider).watchIds(kind);
});
