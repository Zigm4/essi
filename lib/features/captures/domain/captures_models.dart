import 'package:flutter/foundation.dart';

@immutable
class TagModel {
  final String id;
  final String displayName;
  final String name;
  final String? colorHex;

  const TagModel({
    required this.id,
    required this.displayName,
    required this.name,
    this.colorHex,
  });
}

@immutable
class NoteModel {
  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<TagModel> tags;

  const NoteModel({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.updatedAt,
    required this.tags,
  });
}

@immutable
class LinkModel {
  final String id;
  final String title;
  final String url;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<TagModel> tags;

  const LinkModel({
    required this.id,
    required this.title,
    required this.url,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
    required this.tags,
  });
}
