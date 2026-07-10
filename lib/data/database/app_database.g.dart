// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $NotesTable extends Notes with TableInfo<$NotesTable, Note> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $NotesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _bodyMeta = const VerificationMeta('body');
  @override
  late final GeneratedColumn<String> body = GeneratedColumn<String>(
    'body',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, title, body, createdAt, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'notes';
  @override
  VerificationContext validateIntegrity(
    Insertable<Note> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('body')) {
      context.handle(
        _bodyMeta,
        body.isAcceptableOrUnknown(data['body']!, _bodyMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Note map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Note(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      body: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}body'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $NotesTable createAlias(String alias) {
    return $NotesTable(attachedDatabase, alias);
  }
}

class Note extends DataClass implements Insertable<Note> {
  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Note({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title'] = Variable<String>(title);
    map['body'] = Variable<String>(body);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  NotesCompanion toCompanion(bool nullToAbsent) {
    return NotesCompanion(
      id: Value(id),
      title: Value(title),
      body: Value(body),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Note.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Note(
      id: serializer.fromJson<String>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      body: serializer.fromJson<String>(json['body']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'title': serializer.toJson<String>(title),
      'body': serializer.toJson<String>(body),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Note copyWith({
    String? id,
    String? title,
    String? body,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Note(
    id: id ?? this.id,
    title: title ?? this.title,
    body: body ?? this.body,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  Note copyWithCompanion(NotesCompanion data) {
    return Note(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      body: data.body.present ? data.body.value : this.body,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Note(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, title, body, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Note &&
          other.id == this.id &&
          other.title == this.title &&
          other.body == this.body &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class NotesCompanion extends UpdateCompanion<Note> {
  final Value<String> id;
  final Value<String> title;
  final Value<String> body;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const NotesCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.body = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  NotesCompanion.insert({
    required String id,
    this.title = const Value.absent(),
    this.body = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<Note> custom({
    Expression<String>? id,
    Expression<String>? title,
    Expression<String>? body,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (body != null) 'body': body,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  NotesCompanion copyWith({
    Value<String>? id,
    Value<String>? title,
    Value<String>? body,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return NotesCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (body.present) {
      map['body'] = Variable<String>(body.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('NotesCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LinksTable extends Links with TableInfo<$LinksTable, Link> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LinksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _urlMeta = const VerificationMeta('url');
  @override
  late final GeneratedColumn<String> url = GeneratedColumn<String>(
    'url',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    title,
    url,
    note,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'links';
  @override
  VerificationContext validateIntegrity(
    Insertable<Link> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('url')) {
      context.handle(
        _urlMeta,
        url.isAcceptableOrUnknown(data['url']!, _urlMeta),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Link map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Link(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      url: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}url'],
      )!,
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $LinksTable createAlias(String alias) {
    return $LinksTable(attachedDatabase, alias);
  }
}

class Link extends DataClass implements Insertable<Link> {
  final String id;
  final String title;
  final String url;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Link({
    required this.id,
    required this.title,
    required this.url,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title'] = Variable<String>(title);
    map['url'] = Variable<String>(url);
    map['note'] = Variable<String>(note);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  LinksCompanion toCompanion(bool nullToAbsent) {
    return LinksCompanion(
      id: Value(id),
      title: Value(title),
      url: Value(url),
      note: Value(note),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Link.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Link(
      id: serializer.fromJson<String>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      url: serializer.fromJson<String>(json['url']),
      note: serializer.fromJson<String>(json['note']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'title': serializer.toJson<String>(title),
      'url': serializer.toJson<String>(url),
      'note': serializer.toJson<String>(note),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Link copyWith({
    String? id,
    String? title,
    String? url,
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Link(
    id: id ?? this.id,
    title: title ?? this.title,
    url: url ?? this.url,
    note: note ?? this.note,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  Link copyWithCompanion(LinksCompanion data) {
    return Link(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      url: data.url.present ? data.url.value : this.url,
      note: data.note.present ? data.note.value : this.note,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Link(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('url: $url, ')
          ..write('note: $note, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, title, url, note, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Link &&
          other.id == this.id &&
          other.title == this.title &&
          other.url == this.url &&
          other.note == this.note &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class LinksCompanion extends UpdateCompanion<Link> {
  final Value<String> id;
  final Value<String> title;
  final Value<String> url;
  final Value<String> note;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const LinksCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.url = const Value.absent(),
    this.note = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LinksCompanion.insert({
    required String id,
    this.title = const Value.absent(),
    this.url = const Value.absent(),
    this.note = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<Link> custom({
    Expression<String>? id,
    Expression<String>? title,
    Expression<String>? url,
    Expression<String>? note,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (url != null) 'url': url,
      if (note != null) 'note': note,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LinksCompanion copyWith({
    Value<String>? id,
    Value<String>? title,
    Value<String>? url,
    Value<String>? note,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return LinksCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      url: url ?? this.url,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (url.present) {
      map['url'] = Variable<String>(url.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LinksCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('url: $url, ')
          ..write('note: $note, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TagsTable extends Tags with TableInfo<$TagsTable, Tag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _displayNameMeta = const VerificationMeta(
    'displayName',
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _colorHexMeta = const VerificationMeta(
    'colorHex',
  );
  @override
  late final GeneratedColumn<String> colorHex = GeneratedColumn<String>(
    'color_hex',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [id, displayName, name, colorHex];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'tags';
  @override
  VerificationContext validateIntegrity(
    Insertable<Tag> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('display_name')) {
      context.handle(
        _displayNameMeta,
        displayName.isAcceptableOrUnknown(
          data['display_name']!,
          _displayNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_displayNameMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('color_hex')) {
      context.handle(
        _colorHexMeta,
        colorHex.isAcceptableOrUnknown(data['color_hex']!, _colorHexMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Tag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Tag(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      colorHex: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}color_hex'],
      ),
    );
  }

  @override
  $TagsTable createAlias(String alias) {
    return $TagsTable(attachedDatabase, alias);
  }
}

class Tag extends DataClass implements Insertable<Tag> {
  final String id;
  final String displayName;
  final String name;
  final String? colorHex;
  const Tag({
    required this.id,
    required this.displayName,
    required this.name,
    this.colorHex,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['display_name'] = Variable<String>(displayName);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || colorHex != null) {
      map['color_hex'] = Variable<String>(colorHex);
    }
    return map;
  }

  TagsCompanion toCompanion(bool nullToAbsent) {
    return TagsCompanion(
      id: Value(id),
      displayName: Value(displayName),
      name: Value(name),
      colorHex: colorHex == null && nullToAbsent
          ? const Value.absent()
          : Value(colorHex),
    );
  }

  factory Tag.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Tag(
      id: serializer.fromJson<String>(json['id']),
      displayName: serializer.fromJson<String>(json['displayName']),
      name: serializer.fromJson<String>(json['name']),
      colorHex: serializer.fromJson<String?>(json['colorHex']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'displayName': serializer.toJson<String>(displayName),
      'name': serializer.toJson<String>(name),
      'colorHex': serializer.toJson<String?>(colorHex),
    };
  }

  Tag copyWith({
    String? id,
    String? displayName,
    String? name,
    Value<String?> colorHex = const Value.absent(),
  }) => Tag(
    id: id ?? this.id,
    displayName: displayName ?? this.displayName,
    name: name ?? this.name,
    colorHex: colorHex.present ? colorHex.value : this.colorHex,
  );
  Tag copyWithCompanion(TagsCompanion data) {
    return Tag(
      id: data.id.present ? data.id.value : this.id,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      name: data.name.present ? data.name.value : this.name,
      colorHex: data.colorHex.present ? data.colorHex.value : this.colorHex,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Tag(')
          ..write('id: $id, ')
          ..write('displayName: $displayName, ')
          ..write('name: $name, ')
          ..write('colorHex: $colorHex')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, displayName, name, colorHex);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Tag &&
          other.id == this.id &&
          other.displayName == this.displayName &&
          other.name == this.name &&
          other.colorHex == this.colorHex);
}

class TagsCompanion extends UpdateCompanion<Tag> {
  final Value<String> id;
  final Value<String> displayName;
  final Value<String> name;
  final Value<String?> colorHex;
  final Value<int> rowid;
  const TagsCompanion({
    this.id = const Value.absent(),
    this.displayName = const Value.absent(),
    this.name = const Value.absent(),
    this.colorHex = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TagsCompanion.insert({
    required String id,
    required String displayName,
    required String name,
    this.colorHex = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       displayName = Value(displayName),
       name = Value(name);
  static Insertable<Tag> custom({
    Expression<String>? id,
    Expression<String>? displayName,
    Expression<String>? name,
    Expression<String>? colorHex,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (displayName != null) 'display_name': displayName,
      if (name != null) 'name': name,
      if (colorHex != null) 'color_hex': colorHex,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TagsCompanion copyWith({
    Value<String>? id,
    Value<String>? displayName,
    Value<String>? name,
    Value<String?>? colorHex,
    Value<int>? rowid,
  }) {
    return TagsCompanion(
      id: id ?? this.id,
      displayName: displayName ?? this.displayName,
      name: name ?? this.name,
      colorHex: colorHex ?? this.colorHex,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (colorHex.present) {
      map['color_hex'] = Variable<String>(colorHex.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TagsCompanion(')
          ..write('id: $id, ')
          ..write('displayName: $displayName, ')
          ..write('name: $name, ')
          ..write('colorHex: $colorHex, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $NoteTagsTable extends NoteTags with TableInfo<$NoteTagsTable, NoteTag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $NoteTagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _noteIdMeta = const VerificationMeta('noteId');
  @override
  late final GeneratedColumn<String> noteId = GeneratedColumn<String>(
    'note_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES notes (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _tagIdMeta = const VerificationMeta('tagId');
  @override
  late final GeneratedColumn<String> tagId = GeneratedColumn<String>(
    'tag_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES tags (id) ON DELETE CASCADE',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [noteId, tagId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'note_tags';
  @override
  VerificationContext validateIntegrity(
    Insertable<NoteTag> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('note_id')) {
      context.handle(
        _noteIdMeta,
        noteId.isAcceptableOrUnknown(data['note_id']!, _noteIdMeta),
      );
    } else if (isInserting) {
      context.missing(_noteIdMeta);
    }
    if (data.containsKey('tag_id')) {
      context.handle(
        _tagIdMeta,
        tagId.isAcceptableOrUnknown(data['tag_id']!, _tagIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tagIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {noteId, tagId};
  @override
  NoteTag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return NoteTag(
      noteId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note_id'],
      )!,
      tagId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tag_id'],
      )!,
    );
  }

  @override
  $NoteTagsTable createAlias(String alias) {
    return $NoteTagsTable(attachedDatabase, alias);
  }
}

class NoteTag extends DataClass implements Insertable<NoteTag> {
  final String noteId;
  final String tagId;
  const NoteTag({required this.noteId, required this.tagId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['note_id'] = Variable<String>(noteId);
    map['tag_id'] = Variable<String>(tagId);
    return map;
  }

  NoteTagsCompanion toCompanion(bool nullToAbsent) {
    return NoteTagsCompanion(noteId: Value(noteId), tagId: Value(tagId));
  }

  factory NoteTag.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return NoteTag(
      noteId: serializer.fromJson<String>(json['noteId']),
      tagId: serializer.fromJson<String>(json['tagId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'noteId': serializer.toJson<String>(noteId),
      'tagId': serializer.toJson<String>(tagId),
    };
  }

  NoteTag copyWith({String? noteId, String? tagId}) =>
      NoteTag(noteId: noteId ?? this.noteId, tagId: tagId ?? this.tagId);
  NoteTag copyWithCompanion(NoteTagsCompanion data) {
    return NoteTag(
      noteId: data.noteId.present ? data.noteId.value : this.noteId,
      tagId: data.tagId.present ? data.tagId.value : this.tagId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('NoteTag(')
          ..write('noteId: $noteId, ')
          ..write('tagId: $tagId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(noteId, tagId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is NoteTag &&
          other.noteId == this.noteId &&
          other.tagId == this.tagId);
}

class NoteTagsCompanion extends UpdateCompanion<NoteTag> {
  final Value<String> noteId;
  final Value<String> tagId;
  final Value<int> rowid;
  const NoteTagsCompanion({
    this.noteId = const Value.absent(),
    this.tagId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  NoteTagsCompanion.insert({
    required String noteId,
    required String tagId,
    this.rowid = const Value.absent(),
  }) : noteId = Value(noteId),
       tagId = Value(tagId);
  static Insertable<NoteTag> custom({
    Expression<String>? noteId,
    Expression<String>? tagId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (noteId != null) 'note_id': noteId,
      if (tagId != null) 'tag_id': tagId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  NoteTagsCompanion copyWith({
    Value<String>? noteId,
    Value<String>? tagId,
    Value<int>? rowid,
  }) {
    return NoteTagsCompanion(
      noteId: noteId ?? this.noteId,
      tagId: tagId ?? this.tagId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (noteId.present) {
      map['note_id'] = Variable<String>(noteId.value);
    }
    if (tagId.present) {
      map['tag_id'] = Variable<String>(tagId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('NoteTagsCompanion(')
          ..write('noteId: $noteId, ')
          ..write('tagId: $tagId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LinkTagsTable extends LinkTags with TableInfo<$LinkTagsTable, LinkTag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LinkTagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _linkIdMeta = const VerificationMeta('linkId');
  @override
  late final GeneratedColumn<String> linkId = GeneratedColumn<String>(
    'link_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES links (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _tagIdMeta = const VerificationMeta('tagId');
  @override
  late final GeneratedColumn<String> tagId = GeneratedColumn<String>(
    'tag_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES tags (id) ON DELETE CASCADE',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [linkId, tagId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'link_tags';
  @override
  VerificationContext validateIntegrity(
    Insertable<LinkTag> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('link_id')) {
      context.handle(
        _linkIdMeta,
        linkId.isAcceptableOrUnknown(data['link_id']!, _linkIdMeta),
      );
    } else if (isInserting) {
      context.missing(_linkIdMeta);
    }
    if (data.containsKey('tag_id')) {
      context.handle(
        _tagIdMeta,
        tagId.isAcceptableOrUnknown(data['tag_id']!, _tagIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tagIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {linkId, tagId};
  @override
  LinkTag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LinkTag(
      linkId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}link_id'],
      )!,
      tagId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tag_id'],
      )!,
    );
  }

  @override
  $LinkTagsTable createAlias(String alias) {
    return $LinkTagsTable(attachedDatabase, alias);
  }
}

class LinkTag extends DataClass implements Insertable<LinkTag> {
  final String linkId;
  final String tagId;
  const LinkTag({required this.linkId, required this.tagId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['link_id'] = Variable<String>(linkId);
    map['tag_id'] = Variable<String>(tagId);
    return map;
  }

  LinkTagsCompanion toCompanion(bool nullToAbsent) {
    return LinkTagsCompanion(linkId: Value(linkId), tagId: Value(tagId));
  }

  factory LinkTag.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LinkTag(
      linkId: serializer.fromJson<String>(json['linkId']),
      tagId: serializer.fromJson<String>(json['tagId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'linkId': serializer.toJson<String>(linkId),
      'tagId': serializer.toJson<String>(tagId),
    };
  }

  LinkTag copyWith({String? linkId, String? tagId}) =>
      LinkTag(linkId: linkId ?? this.linkId, tagId: tagId ?? this.tagId);
  LinkTag copyWithCompanion(LinkTagsCompanion data) {
    return LinkTag(
      linkId: data.linkId.present ? data.linkId.value : this.linkId,
      tagId: data.tagId.present ? data.tagId.value : this.tagId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LinkTag(')
          ..write('linkId: $linkId, ')
          ..write('tagId: $tagId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(linkId, tagId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LinkTag &&
          other.linkId == this.linkId &&
          other.tagId == this.tagId);
}

class LinkTagsCompanion extends UpdateCompanion<LinkTag> {
  final Value<String> linkId;
  final Value<String> tagId;
  final Value<int> rowid;
  const LinkTagsCompanion({
    this.linkId = const Value.absent(),
    this.tagId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LinkTagsCompanion.insert({
    required String linkId,
    required String tagId,
    this.rowid = const Value.absent(),
  }) : linkId = Value(linkId),
       tagId = Value(tagId);
  static Insertable<LinkTag> custom({
    Expression<String>? linkId,
    Expression<String>? tagId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (linkId != null) 'link_id': linkId,
      if (tagId != null) 'tag_id': tagId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LinkTagsCompanion copyWith({
    Value<String>? linkId,
    Value<String>? tagId,
    Value<int>? rowid,
  }) {
    return LinkTagsCompanion(
      linkId: linkId ?? this.linkId,
      tagId: tagId ?? this.tagId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (linkId.present) {
      map['link_id'] = Variable<String>(linkId.value);
    }
    if (tagId.present) {
      map['tag_id'] = Variable<String>(tagId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LinkTagsCompanion(')
          ..write('linkId: $linkId, ')
          ..write('tagId: $tagId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ShipsTable extends Ships with TableInfo<$ShipsTable, Ship> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ShipsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _modelKeyMeta = const VerificationMeta(
    'modelKey',
  );
  @override
  late final GeneratedColumn<String> modelKey = GeneratedColumn<String>(
    'model_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _customModelLabelMeta = const VerificationMeta(
    'customModelLabel',
  );
  @override
  late final GeneratedColumn<String> customModelLabel = GeneratedColumn<String>(
    'custom_model_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _registeredMeta = const VerificationMeta(
    'registered',
  );
  @override
  late final GeneratedColumn<bool> registered = GeneratedColumn<bool>(
    'registered',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("registered" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _locationKeyMeta = const VerificationMeta(
    'locationKey',
  );
  @override
  late final GeneratedColumn<String> locationKey = GeneratedColumn<String>(
    'location_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _customLocationMeta = const VerificationMeta(
    'customLocation',
  );
  @override
  late final GeneratedColumn<String> customLocation = GeneratedColumn<String>(
    'custom_location',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationZoneMeta = const VerificationMeta(
    'locationZone',
  );
  @override
  late final GeneratedColumn<int> locationZone = GeneratedColumn<int>(
    'location_zone',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationSectorMeta = const VerificationMeta(
    'locationSector',
  );
  @override
  late final GeneratedColumn<String> locationSector = GeneratedColumn<String>(
    'location_sector',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _locationSLMeta = const VerificationMeta(
    'locationSL',
  );
  @override
  late final GeneratedColumn<int> locationSL = GeneratedColumn<int>(
    'location_s_l',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _hullMeta = const VerificationMeta('hull');
  @override
  late final GeneratedColumn<int> hull = GeneratedColumn<int>(
    'hull',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _pilotNameMeta = const VerificationMeta(
    'pilotName',
  );
  @override
  late final GeneratedColumn<String> pilotName = GeneratedColumn<String>(
    'pilot_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _gunnerNameMeta = const VerificationMeta(
    'gunnerName',
  );
  @override
  late final GeneratedColumn<String> gunnerName = GeneratedColumn<String>(
    'gunner_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _cartographerNameMeta = const VerificationMeta(
    'cartographerName',
  );
  @override
  late final GeneratedColumn<String> cartographerName = GeneratedColumn<String>(
    'cartographer_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _prospectorNameMeta = const VerificationMeta(
    'prospectorName',
  );
  @override
  late final GeneratedColumn<String> prospectorName = GeneratedColumn<String>(
    'prospector_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _signallerNameMeta = const VerificationMeta(
    'signallerName',
  );
  @override
  late final GeneratedColumn<String> signallerName = GeneratedColumn<String>(
    'signaller_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _technicianNameMeta = const VerificationMeta(
    'technicianName',
  );
  @override
  late final GeneratedColumn<String> technicianName = GeneratedColumn<String>(
    'technician_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sentryNameMeta = const VerificationMeta(
    'sentryName',
  );
  @override
  late final GeneratedColumn<String> sentryName = GeneratedColumn<String>(
    'sentry_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fabricatorNameMeta = const VerificationMeta(
    'fabricatorName',
  );
  @override
  late final GeneratedColumn<String> fabricatorName = GeneratedColumn<String>(
    'fabricator_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _medicNameMeta = const VerificationMeta(
    'medicName',
  );
  @override
  late final GeneratedColumn<String> medicName = GeneratedColumn<String>(
    'medic_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _quartermasterNameMeta = const VerificationMeta(
    'quartermasterName',
  );
  @override
  late final GeneratedColumn<String> quartermasterName =
      GeneratedColumn<String>(
        'quartermaster_name',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _chefNameMeta = const VerificationMeta(
    'chefName',
  );
  @override
  late final GeneratedColumn<String> chefName = GeneratedColumn<String>(
    'chef_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _alchemistNameMeta = const VerificationMeta(
    'alchemistName',
  );
  @override
  late final GeneratedColumn<String> alchemistName = GeneratedColumn<String>(
    'alchemist_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    modelKey,
    customModelLabel,
    registered,
    locationKey,
    customLocation,
    locationZone,
    locationSector,
    locationSL,
    hull,
    pilotName,
    gunnerName,
    cartographerName,
    prospectorName,
    signallerName,
    technicianName,
    sentryName,
    fabricatorName,
    medicName,
    quartermasterName,
    chefName,
    alchemistName,
    note,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'ships';
  @override
  VerificationContext validateIntegrity(
    Insertable<Ship> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    }
    if (data.containsKey('model_key')) {
      context.handle(
        _modelKeyMeta,
        modelKey.isAcceptableOrUnknown(data['model_key']!, _modelKeyMeta),
      );
    }
    if (data.containsKey('custom_model_label')) {
      context.handle(
        _customModelLabelMeta,
        customModelLabel.isAcceptableOrUnknown(
          data['custom_model_label']!,
          _customModelLabelMeta,
        ),
      );
    }
    if (data.containsKey('registered')) {
      context.handle(
        _registeredMeta,
        registered.isAcceptableOrUnknown(data['registered']!, _registeredMeta),
      );
    }
    if (data.containsKey('location_key')) {
      context.handle(
        _locationKeyMeta,
        locationKey.isAcceptableOrUnknown(
          data['location_key']!,
          _locationKeyMeta,
        ),
      );
    }
    if (data.containsKey('custom_location')) {
      context.handle(
        _customLocationMeta,
        customLocation.isAcceptableOrUnknown(
          data['custom_location']!,
          _customLocationMeta,
        ),
      );
    }
    if (data.containsKey('location_zone')) {
      context.handle(
        _locationZoneMeta,
        locationZone.isAcceptableOrUnknown(
          data['location_zone']!,
          _locationZoneMeta,
        ),
      );
    }
    if (data.containsKey('location_sector')) {
      context.handle(
        _locationSectorMeta,
        locationSector.isAcceptableOrUnknown(
          data['location_sector']!,
          _locationSectorMeta,
        ),
      );
    }
    if (data.containsKey('location_s_l')) {
      context.handle(
        _locationSLMeta,
        locationSL.isAcceptableOrUnknown(
          data['location_s_l']!,
          _locationSLMeta,
        ),
      );
    }
    if (data.containsKey('hull')) {
      context.handle(
        _hullMeta,
        hull.isAcceptableOrUnknown(data['hull']!, _hullMeta),
      );
    }
    if (data.containsKey('pilot_name')) {
      context.handle(
        _pilotNameMeta,
        pilotName.isAcceptableOrUnknown(data['pilot_name']!, _pilotNameMeta),
      );
    }
    if (data.containsKey('gunner_name')) {
      context.handle(
        _gunnerNameMeta,
        gunnerName.isAcceptableOrUnknown(data['gunner_name']!, _gunnerNameMeta),
      );
    }
    if (data.containsKey('cartographer_name')) {
      context.handle(
        _cartographerNameMeta,
        cartographerName.isAcceptableOrUnknown(
          data['cartographer_name']!,
          _cartographerNameMeta,
        ),
      );
    }
    if (data.containsKey('prospector_name')) {
      context.handle(
        _prospectorNameMeta,
        prospectorName.isAcceptableOrUnknown(
          data['prospector_name']!,
          _prospectorNameMeta,
        ),
      );
    }
    if (data.containsKey('signaller_name')) {
      context.handle(
        _signallerNameMeta,
        signallerName.isAcceptableOrUnknown(
          data['signaller_name']!,
          _signallerNameMeta,
        ),
      );
    }
    if (data.containsKey('technician_name')) {
      context.handle(
        _technicianNameMeta,
        technicianName.isAcceptableOrUnknown(
          data['technician_name']!,
          _technicianNameMeta,
        ),
      );
    }
    if (data.containsKey('sentry_name')) {
      context.handle(
        _sentryNameMeta,
        sentryName.isAcceptableOrUnknown(data['sentry_name']!, _sentryNameMeta),
      );
    }
    if (data.containsKey('fabricator_name')) {
      context.handle(
        _fabricatorNameMeta,
        fabricatorName.isAcceptableOrUnknown(
          data['fabricator_name']!,
          _fabricatorNameMeta,
        ),
      );
    }
    if (data.containsKey('medic_name')) {
      context.handle(
        _medicNameMeta,
        medicName.isAcceptableOrUnknown(data['medic_name']!, _medicNameMeta),
      );
    }
    if (data.containsKey('quartermaster_name')) {
      context.handle(
        _quartermasterNameMeta,
        quartermasterName.isAcceptableOrUnknown(
          data['quartermaster_name']!,
          _quartermasterNameMeta,
        ),
      );
    }
    if (data.containsKey('chef_name')) {
      context.handle(
        _chefNameMeta,
        chefName.isAcceptableOrUnknown(data['chef_name']!, _chefNameMeta),
      );
    }
    if (data.containsKey('alchemist_name')) {
      context.handle(
        _alchemistNameMeta,
        alchemistName.isAcceptableOrUnknown(
          data['alchemist_name']!,
          _alchemistNameMeta,
        ),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Ship map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Ship(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      modelKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}model_key'],
      ),
      customModelLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}custom_model_label'],
      ),
      registered: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}registered'],
      )!,
      locationKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_key'],
      ),
      customLocation: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}custom_location'],
      ),
      locationZone: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}location_zone'],
      ),
      locationSector: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location_sector'],
      ),
      locationSL: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}location_s_l'],
      ),
      hull: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}hull'],
      ),
      pilotName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pilot_name'],
      ),
      gunnerName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}gunner_name'],
      ),
      cartographerName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cartographer_name'],
      ),
      prospectorName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}prospector_name'],
      ),
      signallerName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}signaller_name'],
      ),
      technicianName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}technician_name'],
      ),
      sentryName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sentry_name'],
      ),
      fabricatorName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fabricator_name'],
      ),
      medicName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}medic_name'],
      ),
      quartermasterName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}quartermaster_name'],
      ),
      chefName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}chef_name'],
      ),
      alchemistName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}alchemist_name'],
      ),
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $ShipsTable createAlias(String alias) {
    return $ShipsTable(attachedDatabase, alias);
  }
}

class Ship extends DataClass implements Insertable<Ship> {
  final String id;
  final String name;
  final String? modelKey;
  final String? customModelLabel;
  final bool registered;
  final String? locationKey;
  final String? customLocation;
  final int? locationZone;
  final String? locationSector;
  final int? locationSL;
  final int? hull;
  final String? pilotName;
  final String? gunnerName;
  final String? cartographerName;
  final String? prospectorName;
  final String? signallerName;
  final String? technicianName;
  final String? sentryName;
  final String? fabricatorName;
  final String? medicName;
  final String? quartermasterName;
  final String? chefName;
  final String? alchemistName;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;
  const Ship({
    required this.id,
    required this.name,
    this.modelKey,
    this.customModelLabel,
    required this.registered,
    this.locationKey,
    this.customLocation,
    this.locationZone,
    this.locationSector,
    this.locationSL,
    this.hull,
    this.pilotName,
    this.gunnerName,
    this.cartographerName,
    this.prospectorName,
    this.signallerName,
    this.technicianName,
    this.sentryName,
    this.fabricatorName,
    this.medicName,
    this.quartermasterName,
    this.chefName,
    this.alchemistName,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || modelKey != null) {
      map['model_key'] = Variable<String>(modelKey);
    }
    if (!nullToAbsent || customModelLabel != null) {
      map['custom_model_label'] = Variable<String>(customModelLabel);
    }
    map['registered'] = Variable<bool>(registered);
    if (!nullToAbsent || locationKey != null) {
      map['location_key'] = Variable<String>(locationKey);
    }
    if (!nullToAbsent || customLocation != null) {
      map['custom_location'] = Variable<String>(customLocation);
    }
    if (!nullToAbsent || locationZone != null) {
      map['location_zone'] = Variable<int>(locationZone);
    }
    if (!nullToAbsent || locationSector != null) {
      map['location_sector'] = Variable<String>(locationSector);
    }
    if (!nullToAbsent || locationSL != null) {
      map['location_s_l'] = Variable<int>(locationSL);
    }
    if (!nullToAbsent || hull != null) {
      map['hull'] = Variable<int>(hull);
    }
    if (!nullToAbsent || pilotName != null) {
      map['pilot_name'] = Variable<String>(pilotName);
    }
    if (!nullToAbsent || gunnerName != null) {
      map['gunner_name'] = Variable<String>(gunnerName);
    }
    if (!nullToAbsent || cartographerName != null) {
      map['cartographer_name'] = Variable<String>(cartographerName);
    }
    if (!nullToAbsent || prospectorName != null) {
      map['prospector_name'] = Variable<String>(prospectorName);
    }
    if (!nullToAbsent || signallerName != null) {
      map['signaller_name'] = Variable<String>(signallerName);
    }
    if (!nullToAbsent || technicianName != null) {
      map['technician_name'] = Variable<String>(technicianName);
    }
    if (!nullToAbsent || sentryName != null) {
      map['sentry_name'] = Variable<String>(sentryName);
    }
    if (!nullToAbsent || fabricatorName != null) {
      map['fabricator_name'] = Variable<String>(fabricatorName);
    }
    if (!nullToAbsent || medicName != null) {
      map['medic_name'] = Variable<String>(medicName);
    }
    if (!nullToAbsent || quartermasterName != null) {
      map['quartermaster_name'] = Variable<String>(quartermasterName);
    }
    if (!nullToAbsent || chefName != null) {
      map['chef_name'] = Variable<String>(chefName);
    }
    if (!nullToAbsent || alchemistName != null) {
      map['alchemist_name'] = Variable<String>(alchemistName);
    }
    map['note'] = Variable<String>(note);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  ShipsCompanion toCompanion(bool nullToAbsent) {
    return ShipsCompanion(
      id: Value(id),
      name: Value(name),
      modelKey: modelKey == null && nullToAbsent
          ? const Value.absent()
          : Value(modelKey),
      customModelLabel: customModelLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(customModelLabel),
      registered: Value(registered),
      locationKey: locationKey == null && nullToAbsent
          ? const Value.absent()
          : Value(locationKey),
      customLocation: customLocation == null && nullToAbsent
          ? const Value.absent()
          : Value(customLocation),
      locationZone: locationZone == null && nullToAbsent
          ? const Value.absent()
          : Value(locationZone),
      locationSector: locationSector == null && nullToAbsent
          ? const Value.absent()
          : Value(locationSector),
      locationSL: locationSL == null && nullToAbsent
          ? const Value.absent()
          : Value(locationSL),
      hull: hull == null && nullToAbsent ? const Value.absent() : Value(hull),
      pilotName: pilotName == null && nullToAbsent
          ? const Value.absent()
          : Value(pilotName),
      gunnerName: gunnerName == null && nullToAbsent
          ? const Value.absent()
          : Value(gunnerName),
      cartographerName: cartographerName == null && nullToAbsent
          ? const Value.absent()
          : Value(cartographerName),
      prospectorName: prospectorName == null && nullToAbsent
          ? const Value.absent()
          : Value(prospectorName),
      signallerName: signallerName == null && nullToAbsent
          ? const Value.absent()
          : Value(signallerName),
      technicianName: technicianName == null && nullToAbsent
          ? const Value.absent()
          : Value(technicianName),
      sentryName: sentryName == null && nullToAbsent
          ? const Value.absent()
          : Value(sentryName),
      fabricatorName: fabricatorName == null && nullToAbsent
          ? const Value.absent()
          : Value(fabricatorName),
      medicName: medicName == null && nullToAbsent
          ? const Value.absent()
          : Value(medicName),
      quartermasterName: quartermasterName == null && nullToAbsent
          ? const Value.absent()
          : Value(quartermasterName),
      chefName: chefName == null && nullToAbsent
          ? const Value.absent()
          : Value(chefName),
      alchemistName: alchemistName == null && nullToAbsent
          ? const Value.absent()
          : Value(alchemistName),
      note: Value(note),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory Ship.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Ship(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      modelKey: serializer.fromJson<String?>(json['modelKey']),
      customModelLabel: serializer.fromJson<String?>(json['customModelLabel']),
      registered: serializer.fromJson<bool>(json['registered']),
      locationKey: serializer.fromJson<String?>(json['locationKey']),
      customLocation: serializer.fromJson<String?>(json['customLocation']),
      locationZone: serializer.fromJson<int?>(json['locationZone']),
      locationSector: serializer.fromJson<String?>(json['locationSector']),
      locationSL: serializer.fromJson<int?>(json['locationSL']),
      hull: serializer.fromJson<int?>(json['hull']),
      pilotName: serializer.fromJson<String?>(json['pilotName']),
      gunnerName: serializer.fromJson<String?>(json['gunnerName']),
      cartographerName: serializer.fromJson<String?>(json['cartographerName']),
      prospectorName: serializer.fromJson<String?>(json['prospectorName']),
      signallerName: serializer.fromJson<String?>(json['signallerName']),
      technicianName: serializer.fromJson<String?>(json['technicianName']),
      sentryName: serializer.fromJson<String?>(json['sentryName']),
      fabricatorName: serializer.fromJson<String?>(json['fabricatorName']),
      medicName: serializer.fromJson<String?>(json['medicName']),
      quartermasterName: serializer.fromJson<String?>(
        json['quartermasterName'],
      ),
      chefName: serializer.fromJson<String?>(json['chefName']),
      alchemistName: serializer.fromJson<String?>(json['alchemistName']),
      note: serializer.fromJson<String>(json['note']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'modelKey': serializer.toJson<String?>(modelKey),
      'customModelLabel': serializer.toJson<String?>(customModelLabel),
      'registered': serializer.toJson<bool>(registered),
      'locationKey': serializer.toJson<String?>(locationKey),
      'customLocation': serializer.toJson<String?>(customLocation),
      'locationZone': serializer.toJson<int?>(locationZone),
      'locationSector': serializer.toJson<String?>(locationSector),
      'locationSL': serializer.toJson<int?>(locationSL),
      'hull': serializer.toJson<int?>(hull),
      'pilotName': serializer.toJson<String?>(pilotName),
      'gunnerName': serializer.toJson<String?>(gunnerName),
      'cartographerName': serializer.toJson<String?>(cartographerName),
      'prospectorName': serializer.toJson<String?>(prospectorName),
      'signallerName': serializer.toJson<String?>(signallerName),
      'technicianName': serializer.toJson<String?>(technicianName),
      'sentryName': serializer.toJson<String?>(sentryName),
      'fabricatorName': serializer.toJson<String?>(fabricatorName),
      'medicName': serializer.toJson<String?>(medicName),
      'quartermasterName': serializer.toJson<String?>(quartermasterName),
      'chefName': serializer.toJson<String?>(chefName),
      'alchemistName': serializer.toJson<String?>(alchemistName),
      'note': serializer.toJson<String>(note),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  Ship copyWith({
    String? id,
    String? name,
    Value<String?> modelKey = const Value.absent(),
    Value<String?> customModelLabel = const Value.absent(),
    bool? registered,
    Value<String?> locationKey = const Value.absent(),
    Value<String?> customLocation = const Value.absent(),
    Value<int?> locationZone = const Value.absent(),
    Value<String?> locationSector = const Value.absent(),
    Value<int?> locationSL = const Value.absent(),
    Value<int?> hull = const Value.absent(),
    Value<String?> pilotName = const Value.absent(),
    Value<String?> gunnerName = const Value.absent(),
    Value<String?> cartographerName = const Value.absent(),
    Value<String?> prospectorName = const Value.absent(),
    Value<String?> signallerName = const Value.absent(),
    Value<String?> technicianName = const Value.absent(),
    Value<String?> sentryName = const Value.absent(),
    Value<String?> fabricatorName = const Value.absent(),
    Value<String?> medicName = const Value.absent(),
    Value<String?> quartermasterName = const Value.absent(),
    Value<String?> chefName = const Value.absent(),
    Value<String?> alchemistName = const Value.absent(),
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) => Ship(
    id: id ?? this.id,
    name: name ?? this.name,
    modelKey: modelKey.present ? modelKey.value : this.modelKey,
    customModelLabel: customModelLabel.present
        ? customModelLabel.value
        : this.customModelLabel,
    registered: registered ?? this.registered,
    locationKey: locationKey.present ? locationKey.value : this.locationKey,
    customLocation: customLocation.present
        ? customLocation.value
        : this.customLocation,
    locationZone: locationZone.present ? locationZone.value : this.locationZone,
    locationSector: locationSector.present
        ? locationSector.value
        : this.locationSector,
    locationSL: locationSL.present ? locationSL.value : this.locationSL,
    hull: hull.present ? hull.value : this.hull,
    pilotName: pilotName.present ? pilotName.value : this.pilotName,
    gunnerName: gunnerName.present ? gunnerName.value : this.gunnerName,
    cartographerName: cartographerName.present
        ? cartographerName.value
        : this.cartographerName,
    prospectorName: prospectorName.present
        ? prospectorName.value
        : this.prospectorName,
    signallerName: signallerName.present
        ? signallerName.value
        : this.signallerName,
    technicianName: technicianName.present
        ? technicianName.value
        : this.technicianName,
    sentryName: sentryName.present ? sentryName.value : this.sentryName,
    fabricatorName: fabricatorName.present
        ? fabricatorName.value
        : this.fabricatorName,
    medicName: medicName.present ? medicName.value : this.medicName,
    quartermasterName: quartermasterName.present
        ? quartermasterName.value
        : this.quartermasterName,
    chefName: chefName.present ? chefName.value : this.chefName,
    alchemistName: alchemistName.present
        ? alchemistName.value
        : this.alchemistName,
    note: note ?? this.note,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  Ship copyWithCompanion(ShipsCompanion data) {
    return Ship(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      modelKey: data.modelKey.present ? data.modelKey.value : this.modelKey,
      customModelLabel: data.customModelLabel.present
          ? data.customModelLabel.value
          : this.customModelLabel,
      registered: data.registered.present
          ? data.registered.value
          : this.registered,
      locationKey: data.locationKey.present
          ? data.locationKey.value
          : this.locationKey,
      customLocation: data.customLocation.present
          ? data.customLocation.value
          : this.customLocation,
      locationZone: data.locationZone.present
          ? data.locationZone.value
          : this.locationZone,
      locationSector: data.locationSector.present
          ? data.locationSector.value
          : this.locationSector,
      locationSL: data.locationSL.present
          ? data.locationSL.value
          : this.locationSL,
      hull: data.hull.present ? data.hull.value : this.hull,
      pilotName: data.pilotName.present ? data.pilotName.value : this.pilotName,
      gunnerName: data.gunnerName.present
          ? data.gunnerName.value
          : this.gunnerName,
      cartographerName: data.cartographerName.present
          ? data.cartographerName.value
          : this.cartographerName,
      prospectorName: data.prospectorName.present
          ? data.prospectorName.value
          : this.prospectorName,
      signallerName: data.signallerName.present
          ? data.signallerName.value
          : this.signallerName,
      technicianName: data.technicianName.present
          ? data.technicianName.value
          : this.technicianName,
      sentryName: data.sentryName.present
          ? data.sentryName.value
          : this.sentryName,
      fabricatorName: data.fabricatorName.present
          ? data.fabricatorName.value
          : this.fabricatorName,
      medicName: data.medicName.present ? data.medicName.value : this.medicName,
      quartermasterName: data.quartermasterName.present
          ? data.quartermasterName.value
          : this.quartermasterName,
      chefName: data.chefName.present ? data.chefName.value : this.chefName,
      alchemistName: data.alchemistName.present
          ? data.alchemistName.value
          : this.alchemistName,
      note: data.note.present ? data.note.value : this.note,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Ship(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('modelKey: $modelKey, ')
          ..write('customModelLabel: $customModelLabel, ')
          ..write('registered: $registered, ')
          ..write('locationKey: $locationKey, ')
          ..write('customLocation: $customLocation, ')
          ..write('locationZone: $locationZone, ')
          ..write('locationSector: $locationSector, ')
          ..write('locationSL: $locationSL, ')
          ..write('hull: $hull, ')
          ..write('pilotName: $pilotName, ')
          ..write('gunnerName: $gunnerName, ')
          ..write('cartographerName: $cartographerName, ')
          ..write('prospectorName: $prospectorName, ')
          ..write('signallerName: $signallerName, ')
          ..write('technicianName: $technicianName, ')
          ..write('sentryName: $sentryName, ')
          ..write('fabricatorName: $fabricatorName, ')
          ..write('medicName: $medicName, ')
          ..write('quartermasterName: $quartermasterName, ')
          ..write('chefName: $chefName, ')
          ..write('alchemistName: $alchemistName, ')
          ..write('note: $note, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    id,
    name,
    modelKey,
    customModelLabel,
    registered,
    locationKey,
    customLocation,
    locationZone,
    locationSector,
    locationSL,
    hull,
    pilotName,
    gunnerName,
    cartographerName,
    prospectorName,
    signallerName,
    technicianName,
    sentryName,
    fabricatorName,
    medicName,
    quartermasterName,
    chefName,
    alchemistName,
    note,
    createdAt,
    updatedAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Ship &&
          other.id == this.id &&
          other.name == this.name &&
          other.modelKey == this.modelKey &&
          other.customModelLabel == this.customModelLabel &&
          other.registered == this.registered &&
          other.locationKey == this.locationKey &&
          other.customLocation == this.customLocation &&
          other.locationZone == this.locationZone &&
          other.locationSector == this.locationSector &&
          other.locationSL == this.locationSL &&
          other.hull == this.hull &&
          other.pilotName == this.pilotName &&
          other.gunnerName == this.gunnerName &&
          other.cartographerName == this.cartographerName &&
          other.prospectorName == this.prospectorName &&
          other.signallerName == this.signallerName &&
          other.technicianName == this.technicianName &&
          other.sentryName == this.sentryName &&
          other.fabricatorName == this.fabricatorName &&
          other.medicName == this.medicName &&
          other.quartermasterName == this.quartermasterName &&
          other.chefName == this.chefName &&
          other.alchemistName == this.alchemistName &&
          other.note == this.note &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class ShipsCompanion extends UpdateCompanion<Ship> {
  final Value<String> id;
  final Value<String> name;
  final Value<String?> modelKey;
  final Value<String?> customModelLabel;
  final Value<bool> registered;
  final Value<String?> locationKey;
  final Value<String?> customLocation;
  final Value<int?> locationZone;
  final Value<String?> locationSector;
  final Value<int?> locationSL;
  final Value<int?> hull;
  final Value<String?> pilotName;
  final Value<String?> gunnerName;
  final Value<String?> cartographerName;
  final Value<String?> prospectorName;
  final Value<String?> signallerName;
  final Value<String?> technicianName;
  final Value<String?> sentryName;
  final Value<String?> fabricatorName;
  final Value<String?> medicName;
  final Value<String?> quartermasterName;
  final Value<String?> chefName;
  final Value<String?> alchemistName;
  final Value<String> note;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const ShipsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.modelKey = const Value.absent(),
    this.customModelLabel = const Value.absent(),
    this.registered = const Value.absent(),
    this.locationKey = const Value.absent(),
    this.customLocation = const Value.absent(),
    this.locationZone = const Value.absent(),
    this.locationSector = const Value.absent(),
    this.locationSL = const Value.absent(),
    this.hull = const Value.absent(),
    this.pilotName = const Value.absent(),
    this.gunnerName = const Value.absent(),
    this.cartographerName = const Value.absent(),
    this.prospectorName = const Value.absent(),
    this.signallerName = const Value.absent(),
    this.technicianName = const Value.absent(),
    this.sentryName = const Value.absent(),
    this.fabricatorName = const Value.absent(),
    this.medicName = const Value.absent(),
    this.quartermasterName = const Value.absent(),
    this.chefName = const Value.absent(),
    this.alchemistName = const Value.absent(),
    this.note = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ShipsCompanion.insert({
    required String id,
    this.name = const Value.absent(),
    this.modelKey = const Value.absent(),
    this.customModelLabel = const Value.absent(),
    this.registered = const Value.absent(),
    this.locationKey = const Value.absent(),
    this.customLocation = const Value.absent(),
    this.locationZone = const Value.absent(),
    this.locationSector = const Value.absent(),
    this.locationSL = const Value.absent(),
    this.hull = const Value.absent(),
    this.pilotName = const Value.absent(),
    this.gunnerName = const Value.absent(),
    this.cartographerName = const Value.absent(),
    this.prospectorName = const Value.absent(),
    this.signallerName = const Value.absent(),
    this.technicianName = const Value.absent(),
    this.sentryName = const Value.absent(),
    this.fabricatorName = const Value.absent(),
    this.medicName = const Value.absent(),
    this.quartermasterName = const Value.absent(),
    this.chefName = const Value.absent(),
    this.alchemistName = const Value.absent(),
    this.note = const Value.absent(),
    required DateTime createdAt,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<Ship> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? modelKey,
    Expression<String>? customModelLabel,
    Expression<bool>? registered,
    Expression<String>? locationKey,
    Expression<String>? customLocation,
    Expression<int>? locationZone,
    Expression<String>? locationSector,
    Expression<int>? locationSL,
    Expression<int>? hull,
    Expression<String>? pilotName,
    Expression<String>? gunnerName,
    Expression<String>? cartographerName,
    Expression<String>? prospectorName,
    Expression<String>? signallerName,
    Expression<String>? technicianName,
    Expression<String>? sentryName,
    Expression<String>? fabricatorName,
    Expression<String>? medicName,
    Expression<String>? quartermasterName,
    Expression<String>? chefName,
    Expression<String>? alchemistName,
    Expression<String>? note,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (modelKey != null) 'model_key': modelKey,
      if (customModelLabel != null) 'custom_model_label': customModelLabel,
      if (registered != null) 'registered': registered,
      if (locationKey != null) 'location_key': locationKey,
      if (customLocation != null) 'custom_location': customLocation,
      if (locationZone != null) 'location_zone': locationZone,
      if (locationSector != null) 'location_sector': locationSector,
      if (locationSL != null) 'location_s_l': locationSL,
      if (hull != null) 'hull': hull,
      if (pilotName != null) 'pilot_name': pilotName,
      if (gunnerName != null) 'gunner_name': gunnerName,
      if (cartographerName != null) 'cartographer_name': cartographerName,
      if (prospectorName != null) 'prospector_name': prospectorName,
      if (signallerName != null) 'signaller_name': signallerName,
      if (technicianName != null) 'technician_name': technicianName,
      if (sentryName != null) 'sentry_name': sentryName,
      if (fabricatorName != null) 'fabricator_name': fabricatorName,
      if (medicName != null) 'medic_name': medicName,
      if (quartermasterName != null) 'quartermaster_name': quartermasterName,
      if (chefName != null) 'chef_name': chefName,
      if (alchemistName != null) 'alchemist_name': alchemistName,
      if (note != null) 'note': note,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ShipsCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<String?>? modelKey,
    Value<String?>? customModelLabel,
    Value<bool>? registered,
    Value<String?>? locationKey,
    Value<String?>? customLocation,
    Value<int?>? locationZone,
    Value<String?>? locationSector,
    Value<int?>? locationSL,
    Value<int?>? hull,
    Value<String?>? pilotName,
    Value<String?>? gunnerName,
    Value<String?>? cartographerName,
    Value<String?>? prospectorName,
    Value<String?>? signallerName,
    Value<String?>? technicianName,
    Value<String?>? sentryName,
    Value<String?>? fabricatorName,
    Value<String?>? medicName,
    Value<String?>? quartermasterName,
    Value<String?>? chefName,
    Value<String?>? alchemistName,
    Value<String>? note,
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return ShipsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      modelKey: modelKey ?? this.modelKey,
      customModelLabel: customModelLabel ?? this.customModelLabel,
      registered: registered ?? this.registered,
      locationKey: locationKey ?? this.locationKey,
      customLocation: customLocation ?? this.customLocation,
      locationZone: locationZone ?? this.locationZone,
      locationSector: locationSector ?? this.locationSector,
      locationSL: locationSL ?? this.locationSL,
      hull: hull ?? this.hull,
      pilotName: pilotName ?? this.pilotName,
      gunnerName: gunnerName ?? this.gunnerName,
      cartographerName: cartographerName ?? this.cartographerName,
      prospectorName: prospectorName ?? this.prospectorName,
      signallerName: signallerName ?? this.signallerName,
      technicianName: technicianName ?? this.technicianName,
      sentryName: sentryName ?? this.sentryName,
      fabricatorName: fabricatorName ?? this.fabricatorName,
      medicName: medicName ?? this.medicName,
      quartermasterName: quartermasterName ?? this.quartermasterName,
      chefName: chefName ?? this.chefName,
      alchemistName: alchemistName ?? this.alchemistName,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (modelKey.present) {
      map['model_key'] = Variable<String>(modelKey.value);
    }
    if (customModelLabel.present) {
      map['custom_model_label'] = Variable<String>(customModelLabel.value);
    }
    if (registered.present) {
      map['registered'] = Variable<bool>(registered.value);
    }
    if (locationKey.present) {
      map['location_key'] = Variable<String>(locationKey.value);
    }
    if (customLocation.present) {
      map['custom_location'] = Variable<String>(customLocation.value);
    }
    if (locationZone.present) {
      map['location_zone'] = Variable<int>(locationZone.value);
    }
    if (locationSector.present) {
      map['location_sector'] = Variable<String>(locationSector.value);
    }
    if (locationSL.present) {
      map['location_s_l'] = Variable<int>(locationSL.value);
    }
    if (hull.present) {
      map['hull'] = Variable<int>(hull.value);
    }
    if (pilotName.present) {
      map['pilot_name'] = Variable<String>(pilotName.value);
    }
    if (gunnerName.present) {
      map['gunner_name'] = Variable<String>(gunnerName.value);
    }
    if (cartographerName.present) {
      map['cartographer_name'] = Variable<String>(cartographerName.value);
    }
    if (prospectorName.present) {
      map['prospector_name'] = Variable<String>(prospectorName.value);
    }
    if (signallerName.present) {
      map['signaller_name'] = Variable<String>(signallerName.value);
    }
    if (technicianName.present) {
      map['technician_name'] = Variable<String>(technicianName.value);
    }
    if (sentryName.present) {
      map['sentry_name'] = Variable<String>(sentryName.value);
    }
    if (fabricatorName.present) {
      map['fabricator_name'] = Variable<String>(fabricatorName.value);
    }
    if (medicName.present) {
      map['medic_name'] = Variable<String>(medicName.value);
    }
    if (quartermasterName.present) {
      map['quartermaster_name'] = Variable<String>(quartermasterName.value);
    }
    if (chefName.present) {
      map['chef_name'] = Variable<String>(chefName.value);
    }
    if (alchemistName.present) {
      map['alchemist_name'] = Variable<String>(alchemistName.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ShipsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('modelKey: $modelKey, ')
          ..write('customModelLabel: $customModelLabel, ')
          ..write('registered: $registered, ')
          ..write('locationKey: $locationKey, ')
          ..write('customLocation: $customLocation, ')
          ..write('locationZone: $locationZone, ')
          ..write('locationSector: $locationSector, ')
          ..write('locationSL: $locationSL, ')
          ..write('hull: $hull, ')
          ..write('pilotName: $pilotName, ')
          ..write('gunnerName: $gunnerName, ')
          ..write('cartographerName: $cartographerName, ')
          ..write('prospectorName: $prospectorName, ')
          ..write('signallerName: $signallerName, ')
          ..write('technicianName: $technicianName, ')
          ..write('sentryName: $sentryName, ')
          ..write('fabricatorName: $fabricatorName, ')
          ..write('medicName: $medicName, ')
          ..write('quartermasterName: $quartermasterName, ')
          ..write('chefName: $chefName, ')
          ..write('alchemistName: $alchemistName, ')
          ..write('note: $note, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ShipTagsTable extends ShipTags with TableInfo<$ShipTagsTable, ShipTag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ShipTagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _shipIdMeta = const VerificationMeta('shipId');
  @override
  late final GeneratedColumn<String> shipId = GeneratedColumn<String>(
    'ship_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES ships (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _tagIdMeta = const VerificationMeta('tagId');
  @override
  late final GeneratedColumn<String> tagId = GeneratedColumn<String>(
    'tag_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES tags (id) ON DELETE CASCADE',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [shipId, tagId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'ship_tags';
  @override
  VerificationContext validateIntegrity(
    Insertable<ShipTag> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('ship_id')) {
      context.handle(
        _shipIdMeta,
        shipId.isAcceptableOrUnknown(data['ship_id']!, _shipIdMeta),
      );
    } else if (isInserting) {
      context.missing(_shipIdMeta);
    }
    if (data.containsKey('tag_id')) {
      context.handle(
        _tagIdMeta,
        tagId.isAcceptableOrUnknown(data['tag_id']!, _tagIdMeta),
      );
    } else if (isInserting) {
      context.missing(_tagIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {shipId, tagId};
  @override
  ShipTag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ShipTag(
      shipId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ship_id'],
      )!,
      tagId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tag_id'],
      )!,
    );
  }

  @override
  $ShipTagsTable createAlias(String alias) {
    return $ShipTagsTable(attachedDatabase, alias);
  }
}

class ShipTag extends DataClass implements Insertable<ShipTag> {
  final String shipId;
  final String tagId;
  const ShipTag({required this.shipId, required this.tagId});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['ship_id'] = Variable<String>(shipId);
    map['tag_id'] = Variable<String>(tagId);
    return map;
  }

  ShipTagsCompanion toCompanion(bool nullToAbsent) {
    return ShipTagsCompanion(shipId: Value(shipId), tagId: Value(tagId));
  }

  factory ShipTag.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ShipTag(
      shipId: serializer.fromJson<String>(json['shipId']),
      tagId: serializer.fromJson<String>(json['tagId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'shipId': serializer.toJson<String>(shipId),
      'tagId': serializer.toJson<String>(tagId),
    };
  }

  ShipTag copyWith({String? shipId, String? tagId}) =>
      ShipTag(shipId: shipId ?? this.shipId, tagId: tagId ?? this.tagId);
  ShipTag copyWithCompanion(ShipTagsCompanion data) {
    return ShipTag(
      shipId: data.shipId.present ? data.shipId.value : this.shipId,
      tagId: data.tagId.present ? data.tagId.value : this.tagId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ShipTag(')
          ..write('shipId: $shipId, ')
          ..write('tagId: $tagId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(shipId, tagId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ShipTag &&
          other.shipId == this.shipId &&
          other.tagId == this.tagId);
}

class ShipTagsCompanion extends UpdateCompanion<ShipTag> {
  final Value<String> shipId;
  final Value<String> tagId;
  final Value<int> rowid;
  const ShipTagsCompanion({
    this.shipId = const Value.absent(),
    this.tagId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ShipTagsCompanion.insert({
    required String shipId,
    required String tagId,
    this.rowid = const Value.absent(),
  }) : shipId = Value(shipId),
       tagId = Value(tagId);
  static Insertable<ShipTag> custom({
    Expression<String>? shipId,
    Expression<String>? tagId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (shipId != null) 'ship_id': shipId,
      if (tagId != null) 'tag_id': tagId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ShipTagsCompanion copyWith({
    Value<String>? shipId,
    Value<String>? tagId,
    Value<int>? rowid,
  }) {
    return ShipTagsCompanion(
      shipId: shipId ?? this.shipId,
      tagId: tagId ?? this.tagId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (shipId.present) {
      map['ship_id'] = Variable<String>(shipId.value);
    }
    if (tagId.present) {
      map['tag_id'] = Variable<String>(tagId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ShipTagsCompanion(')
          ..write('shipId: $shipId, ')
          ..write('tagId: $tagId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ScanHistoryTable extends ScanHistory
    with TableInfo<$ScanHistoryTable, ScanHistoryData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ScanHistoryTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _modeMeta = const VerificationMeta('mode');
  @override
  late final GeneratedColumn<String> mode = GeneratedColumn<String>(
    'mode',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _erroredMeta = const VerificationMeta(
    'errored',
  );
  @override
  late final GeneratedColumn<bool> errored = GeneratedColumn<bool>(
    'errored',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("errored" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [id, date, mode, payloadJson, errored];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'scan_history';
  @override
  VerificationContext validateIntegrity(
    Insertable<ScanHistoryData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('mode')) {
      context.handle(
        _modeMeta,
        mode.isAcceptableOrUnknown(data['mode']!, _modeMeta),
      );
    } else if (isInserting) {
      context.missing(_modeMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('errored')) {
      context.handle(
        _erroredMeta,
        errored.isAcceptableOrUnknown(data['errored']!, _erroredMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ScanHistoryData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ScanHistoryData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}date'],
      )!,
      mode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}mode'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      errored: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}errored'],
      )!,
    );
  }

  @override
  $ScanHistoryTable createAlias(String alias) {
    return $ScanHistoryTable(attachedDatabase, alias);
  }
}

class ScanHistoryData extends DataClass implements Insertable<ScanHistoryData> {
  final String id;
  final DateTime date;
  final String mode;
  final String payloadJson;
  final bool errored;
  const ScanHistoryData({
    required this.id,
    required this.date,
    required this.mode,
    required this.payloadJson,
    required this.errored,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['date'] = Variable<DateTime>(date);
    map['mode'] = Variable<String>(mode);
    map['payload_json'] = Variable<String>(payloadJson);
    map['errored'] = Variable<bool>(errored);
    return map;
  }

  ScanHistoryCompanion toCompanion(bool nullToAbsent) {
    return ScanHistoryCompanion(
      id: Value(id),
      date: Value(date),
      mode: Value(mode),
      payloadJson: Value(payloadJson),
      errored: Value(errored),
    );
  }

  factory ScanHistoryData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ScanHistoryData(
      id: serializer.fromJson<String>(json['id']),
      date: serializer.fromJson<DateTime>(json['date']),
      mode: serializer.fromJson<String>(json['mode']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      errored: serializer.fromJson<bool>(json['errored']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'date': serializer.toJson<DateTime>(date),
      'mode': serializer.toJson<String>(mode),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'errored': serializer.toJson<bool>(errored),
    };
  }

  ScanHistoryData copyWith({
    String? id,
    DateTime? date,
    String? mode,
    String? payloadJson,
    bool? errored,
  }) => ScanHistoryData(
    id: id ?? this.id,
    date: date ?? this.date,
    mode: mode ?? this.mode,
    payloadJson: payloadJson ?? this.payloadJson,
    errored: errored ?? this.errored,
  );
  ScanHistoryData copyWithCompanion(ScanHistoryCompanion data) {
    return ScanHistoryData(
      id: data.id.present ? data.id.value : this.id,
      date: data.date.present ? data.date.value : this.date,
      mode: data.mode.present ? data.mode.value : this.mode,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      errored: data.errored.present ? data.errored.value : this.errored,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ScanHistoryData(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, date, mode, payloadJson, errored);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ScanHistoryData &&
          other.id == this.id &&
          other.date == this.date &&
          other.mode == this.mode &&
          other.payloadJson == this.payloadJson &&
          other.errored == this.errored);
}

class ScanHistoryCompanion extends UpdateCompanion<ScanHistoryData> {
  final Value<String> id;
  final Value<DateTime> date;
  final Value<String> mode;
  final Value<String> payloadJson;
  final Value<bool> errored;
  final Value<int> rowid;
  const ScanHistoryCompanion({
    this.id = const Value.absent(),
    this.date = const Value.absent(),
    this.mode = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ScanHistoryCompanion.insert({
    required String id,
    required DateTime date,
    required String mode,
    required String payloadJson,
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       date = Value(date),
       mode = Value(mode),
       payloadJson = Value(payloadJson);
  static Insertable<ScanHistoryData> custom({
    Expression<String>? id,
    Expression<DateTime>? date,
    Expression<String>? mode,
    Expression<String>? payloadJson,
    Expression<bool>? errored,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (date != null) 'date': date,
      if (mode != null) 'mode': mode,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (errored != null) 'errored': errored,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ScanHistoryCompanion copyWith({
    Value<String>? id,
    Value<DateTime>? date,
    Value<String>? mode,
    Value<String>? payloadJson,
    Value<bool>? errored,
    Value<int>? rowid,
  }) {
    return ScanHistoryCompanion(
      id: id ?? this.id,
      date: date ?? this.date,
      mode: mode ?? this.mode,
      payloadJson: payloadJson ?? this.payloadJson,
      errored: errored ?? this.errored,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (mode.present) {
      map['mode'] = Variable<String>(mode.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (errored.present) {
      map['errored'] = Variable<bool>(errored.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ScanHistoryCompanion(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TrackerHistoryTable extends TrackerHistory
    with TableInfo<$TrackerHistoryTable, TrackerHistoryData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TrackerHistoryTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _modeMeta = const VerificationMeta('mode');
  @override
  late final GeneratedColumn<String> mode = GeneratedColumn<String>(
    'mode',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _erroredMeta = const VerificationMeta(
    'errored',
  );
  @override
  late final GeneratedColumn<bool> errored = GeneratedColumn<bool>(
    'errored',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("errored" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [id, date, mode, payloadJson, errored];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'tracker_history';
  @override
  VerificationContext validateIntegrity(
    Insertable<TrackerHistoryData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('mode')) {
      context.handle(
        _modeMeta,
        mode.isAcceptableOrUnknown(data['mode']!, _modeMeta),
      );
    } else if (isInserting) {
      context.missing(_modeMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('errored')) {
      context.handle(
        _erroredMeta,
        errored.isAcceptableOrUnknown(data['errored']!, _erroredMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  TrackerHistoryData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TrackerHistoryData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}date'],
      )!,
      mode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}mode'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      errored: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}errored'],
      )!,
    );
  }

  @override
  $TrackerHistoryTable createAlias(String alias) {
    return $TrackerHistoryTable(attachedDatabase, alias);
  }
}

class TrackerHistoryData extends DataClass
    implements Insertable<TrackerHistoryData> {
  final String id;
  final DateTime date;
  final String mode;
  final String payloadJson;
  final bool errored;
  const TrackerHistoryData({
    required this.id,
    required this.date,
    required this.mode,
    required this.payloadJson,
    required this.errored,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['date'] = Variable<DateTime>(date);
    map['mode'] = Variable<String>(mode);
    map['payload_json'] = Variable<String>(payloadJson);
    map['errored'] = Variable<bool>(errored);
    return map;
  }

  TrackerHistoryCompanion toCompanion(bool nullToAbsent) {
    return TrackerHistoryCompanion(
      id: Value(id),
      date: Value(date),
      mode: Value(mode),
      payloadJson: Value(payloadJson),
      errored: Value(errored),
    );
  }

  factory TrackerHistoryData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TrackerHistoryData(
      id: serializer.fromJson<String>(json['id']),
      date: serializer.fromJson<DateTime>(json['date']),
      mode: serializer.fromJson<String>(json['mode']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      errored: serializer.fromJson<bool>(json['errored']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'date': serializer.toJson<DateTime>(date),
      'mode': serializer.toJson<String>(mode),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'errored': serializer.toJson<bool>(errored),
    };
  }

  TrackerHistoryData copyWith({
    String? id,
    DateTime? date,
    String? mode,
    String? payloadJson,
    bool? errored,
  }) => TrackerHistoryData(
    id: id ?? this.id,
    date: date ?? this.date,
    mode: mode ?? this.mode,
    payloadJson: payloadJson ?? this.payloadJson,
    errored: errored ?? this.errored,
  );
  TrackerHistoryData copyWithCompanion(TrackerHistoryCompanion data) {
    return TrackerHistoryData(
      id: data.id.present ? data.id.value : this.id,
      date: data.date.present ? data.date.value : this.date,
      mode: data.mode.present ? data.mode.value : this.mode,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      errored: data.errored.present ? data.errored.value : this.errored,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TrackerHistoryData(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, date, mode, payloadJson, errored);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TrackerHistoryData &&
          other.id == this.id &&
          other.date == this.date &&
          other.mode == this.mode &&
          other.payloadJson == this.payloadJson &&
          other.errored == this.errored);
}

class TrackerHistoryCompanion extends UpdateCompanion<TrackerHistoryData> {
  final Value<String> id;
  final Value<DateTime> date;
  final Value<String> mode;
  final Value<String> payloadJson;
  final Value<bool> errored;
  final Value<int> rowid;
  const TrackerHistoryCompanion({
    this.id = const Value.absent(),
    this.date = const Value.absent(),
    this.mode = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TrackerHistoryCompanion.insert({
    required String id,
    required DateTime date,
    required String mode,
    required String payloadJson,
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       date = Value(date),
       mode = Value(mode),
       payloadJson = Value(payloadJson);
  static Insertable<TrackerHistoryData> custom({
    Expression<String>? id,
    Expression<DateTime>? date,
    Expression<String>? mode,
    Expression<String>? payloadJson,
    Expression<bool>? errored,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (date != null) 'date': date,
      if (mode != null) 'mode': mode,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (errored != null) 'errored': errored,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TrackerHistoryCompanion copyWith({
    Value<String>? id,
    Value<DateTime>? date,
    Value<String>? mode,
    Value<String>? payloadJson,
    Value<bool>? errored,
    Value<int>? rowid,
  }) {
    return TrackerHistoryCompanion(
      id: id ?? this.id,
      date: date ?? this.date,
      mode: mode ?? this.mode,
      payloadJson: payloadJson ?? this.payloadJson,
      errored: errored ?? this.errored,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (mode.present) {
      map['mode'] = Variable<String>(mode.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (errored.present) {
      map['errored'] = Variable<bool>(errored.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TrackerHistoryCompanion(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DiscoveryHistoryTable extends DiscoveryHistory
    with TableInfo<$DiscoveryHistoryTable, DiscoveryHistoryData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DiscoveryHistoryTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _modeMeta = const VerificationMeta('mode');
  @override
  late final GeneratedColumn<String> mode = GeneratedColumn<String>(
    'mode',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _erroredMeta = const VerificationMeta(
    'errored',
  );
  @override
  late final GeneratedColumn<bool> errored = GeneratedColumn<bool>(
    'errored',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("errored" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [id, date, mode, payloadJson, errored];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'discovery_history';
  @override
  VerificationContext validateIntegrity(
    Insertable<DiscoveryHistoryData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('mode')) {
      context.handle(
        _modeMeta,
        mode.isAcceptableOrUnknown(data['mode']!, _modeMeta),
      );
    } else if (isInserting) {
      context.missing(_modeMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('errored')) {
      context.handle(
        _erroredMeta,
        errored.isAcceptableOrUnknown(data['errored']!, _erroredMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DiscoveryHistoryData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DiscoveryHistoryData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}date'],
      )!,
      mode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}mode'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      errored: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}errored'],
      )!,
    );
  }

  @override
  $DiscoveryHistoryTable createAlias(String alias) {
    return $DiscoveryHistoryTable(attachedDatabase, alias);
  }
}

class DiscoveryHistoryData extends DataClass
    implements Insertable<DiscoveryHistoryData> {
  final String id;
  final DateTime date;
  final String mode;
  final String payloadJson;
  final bool errored;
  const DiscoveryHistoryData({
    required this.id,
    required this.date,
    required this.mode,
    required this.payloadJson,
    required this.errored,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['date'] = Variable<DateTime>(date);
    map['mode'] = Variable<String>(mode);
    map['payload_json'] = Variable<String>(payloadJson);
    map['errored'] = Variable<bool>(errored);
    return map;
  }

  DiscoveryHistoryCompanion toCompanion(bool nullToAbsent) {
    return DiscoveryHistoryCompanion(
      id: Value(id),
      date: Value(date),
      mode: Value(mode),
      payloadJson: Value(payloadJson),
      errored: Value(errored),
    );
  }

  factory DiscoveryHistoryData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DiscoveryHistoryData(
      id: serializer.fromJson<String>(json['id']),
      date: serializer.fromJson<DateTime>(json['date']),
      mode: serializer.fromJson<String>(json['mode']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      errored: serializer.fromJson<bool>(json['errored']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'date': serializer.toJson<DateTime>(date),
      'mode': serializer.toJson<String>(mode),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'errored': serializer.toJson<bool>(errored),
    };
  }

  DiscoveryHistoryData copyWith({
    String? id,
    DateTime? date,
    String? mode,
    String? payloadJson,
    bool? errored,
  }) => DiscoveryHistoryData(
    id: id ?? this.id,
    date: date ?? this.date,
    mode: mode ?? this.mode,
    payloadJson: payloadJson ?? this.payloadJson,
    errored: errored ?? this.errored,
  );
  DiscoveryHistoryData copyWithCompanion(DiscoveryHistoryCompanion data) {
    return DiscoveryHistoryData(
      id: data.id.present ? data.id.value : this.id,
      date: data.date.present ? data.date.value : this.date,
      mode: data.mode.present ? data.mode.value : this.mode,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      errored: data.errored.present ? data.errored.value : this.errored,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DiscoveryHistoryData(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, date, mode, payloadJson, errored);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DiscoveryHistoryData &&
          other.id == this.id &&
          other.date == this.date &&
          other.mode == this.mode &&
          other.payloadJson == this.payloadJson &&
          other.errored == this.errored);
}

class DiscoveryHistoryCompanion extends UpdateCompanion<DiscoveryHistoryData> {
  final Value<String> id;
  final Value<DateTime> date;
  final Value<String> mode;
  final Value<String> payloadJson;
  final Value<bool> errored;
  final Value<int> rowid;
  const DiscoveryHistoryCompanion({
    this.id = const Value.absent(),
    this.date = const Value.absent(),
    this.mode = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DiscoveryHistoryCompanion.insert({
    required String id,
    required DateTime date,
    required String mode,
    required String payloadJson,
    this.errored = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       date = Value(date),
       mode = Value(mode),
       payloadJson = Value(payloadJson);
  static Insertable<DiscoveryHistoryData> custom({
    Expression<String>? id,
    Expression<DateTime>? date,
    Expression<String>? mode,
    Expression<String>? payloadJson,
    Expression<bool>? errored,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (date != null) 'date': date,
      if (mode != null) 'mode': mode,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (errored != null) 'errored': errored,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DiscoveryHistoryCompanion copyWith({
    Value<String>? id,
    Value<DateTime>? date,
    Value<String>? mode,
    Value<String>? payloadJson,
    Value<bool>? errored,
    Value<int>? rowid,
  }) {
    return DiscoveryHistoryCompanion(
      id: id ?? this.id,
      date: date ?? this.date,
      mode: mode ?? this.mode,
      payloadJson: payloadJson ?? this.payloadJson,
      errored: errored ?? this.errored,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (mode.present) {
      map['mode'] = Variable<String>(mode.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (errored.present) {
      map['errored'] = Variable<bool>(errored.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DiscoveryHistoryCompanion(')
          ..write('id: $id, ')
          ..write('date: $date, ')
          ..write('mode: $mode, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('errored: $errored, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FavoritesTable extends Favorites
    with TableInfo<$FavoritesTable, Favorite> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FavoritesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _entityTypeMeta = const VerificationMeta(
    'entityType',
  );
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
    'entity_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityIdMeta = const VerificationMeta(
    'entityId',
  );
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
    'entity_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [entityType, entityId, createdAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'favorites';
  @override
  VerificationContext validateIntegrity(
    Insertable<Favorite> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(
        _entityIdMeta,
        entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta),
      );
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {entityType, entityId};
  @override
  Favorite map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Favorite(
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      entityId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_id'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $FavoritesTable createAlias(String alias) {
    return $FavoritesTable(attachedDatabase, alias);
  }
}

class Favorite extends DataClass implements Insertable<Favorite> {
  final String entityType;
  final String entityId;
  final DateTime createdAt;
  const Favorite({
    required this.entityType,
    required this.entityId,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<String>(entityId);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  FavoritesCompanion toCompanion(bool nullToAbsent) {
    return FavoritesCompanion(
      entityType: Value(entityType),
      entityId: Value(entityId),
      createdAt: Value(createdAt),
    );
  }

  factory Favorite.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Favorite(
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<String>(json['entityId']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<String>(entityId),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Favorite copyWith({
    String? entityType,
    String? entityId,
    DateTime? createdAt,
  }) => Favorite(
    entityType: entityType ?? this.entityType,
    entityId: entityId ?? this.entityId,
    createdAt: createdAt ?? this.createdAt,
  );
  Favorite copyWithCompanion(FavoritesCompanion data) {
    return Favorite(
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Favorite(')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(entityType, entityId, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Favorite &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.createdAt == this.createdAt);
}

class FavoritesCompanion extends UpdateCompanion<Favorite> {
  final Value<String> entityType;
  final Value<String> entityId;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const FavoritesCompanion({
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FavoritesCompanion.insert({
    required String entityType,
    required String entityId,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : entityType = Value(entityType),
       entityId = Value(entityId),
       createdAt = Value(createdAt);
  static Insertable<Favorite> custom({
    Expression<String>? entityType,
    Expression<String>? entityId,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FavoritesCompanion copyWith({
    Value<String>? entityType,
    Value<String>? entityId,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return FavoritesCompanion(
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FavoritesCompanion(')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $JobStatusTable extends JobStatus
    with TableInfo<$JobStatusTable, JobStatusData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $JobStatusTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _jobIdMeta = const VerificationMeta('jobId');
  @override
  late final GeneratedColumn<String> jobId = GeneratedColumn<String>(
    'job_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [jobId, status, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'job_status';
  @override
  VerificationContext validateIntegrity(
    Insertable<JobStatusData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('job_id')) {
      context.handle(
        _jobIdMeta,
        jobId.isAcceptableOrUnknown(data['job_id']!, _jobIdMeta),
      );
    } else if (isInserting) {
      context.missing(_jobIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {jobId};
  @override
  JobStatusData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return JobStatusData(
      jobId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}job_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $JobStatusTable createAlias(String alias) {
    return $JobStatusTable(attachedDatabase, alias);
  }
}

class JobStatusData extends DataClass implements Insertable<JobStatusData> {
  final String jobId;
  final String status;
  final DateTime updatedAt;
  const JobStatusData({
    required this.jobId,
    required this.status,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['job_id'] = Variable<String>(jobId);
    map['status'] = Variable<String>(status);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  JobStatusCompanion toCompanion(bool nullToAbsent) {
    return JobStatusCompanion(
      jobId: Value(jobId),
      status: Value(status),
      updatedAt: Value(updatedAt),
    );
  }

  factory JobStatusData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return JobStatusData(
      jobId: serializer.fromJson<String>(json['jobId']),
      status: serializer.fromJson<String>(json['status']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'jobId': serializer.toJson<String>(jobId),
      'status': serializer.toJson<String>(status),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  JobStatusData copyWith({
    String? jobId,
    String? status,
    DateTime? updatedAt,
  }) => JobStatusData(
    jobId: jobId ?? this.jobId,
    status: status ?? this.status,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  JobStatusData copyWithCompanion(JobStatusCompanion data) {
    return JobStatusData(
      jobId: data.jobId.present ? data.jobId.value : this.jobId,
      status: data.status.present ? data.status.value : this.status,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('JobStatusData(')
          ..write('jobId: $jobId, ')
          ..write('status: $status, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(jobId, status, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is JobStatusData &&
          other.jobId == this.jobId &&
          other.status == this.status &&
          other.updatedAt == this.updatedAt);
}

class JobStatusCompanion extends UpdateCompanion<JobStatusData> {
  final Value<String> jobId;
  final Value<String> status;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const JobStatusCompanion({
    this.jobId = const Value.absent(),
    this.status = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  JobStatusCompanion.insert({
    required String jobId,
    required String status,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : jobId = Value(jobId),
       status = Value(status),
       updatedAt = Value(updatedAt);
  static Insertable<JobStatusData> custom({
    Expression<String>? jobId,
    Expression<String>? status,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (jobId != null) 'job_id': jobId,
      if (status != null) 'status': status,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  JobStatusCompanion copyWith({
    Value<String>? jobId,
    Value<String>? status,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return JobStatusCompanion(
      jobId: jobId ?? this.jobId,
      status: status ?? this.status,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (jobId.present) {
      map['job_id'] = Variable<String>(jobId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('JobStatusCompanion(')
          ..write('jobId: $jobId, ')
          ..write('status: $status, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $NotesTable notes = $NotesTable(this);
  late final $LinksTable links = $LinksTable(this);
  late final $TagsTable tags = $TagsTable(this);
  late final $NoteTagsTable noteTags = $NoteTagsTable(this);
  late final $LinkTagsTable linkTags = $LinkTagsTable(this);
  late final $ShipsTable ships = $ShipsTable(this);
  late final $ShipTagsTable shipTags = $ShipTagsTable(this);
  late final $ScanHistoryTable scanHistory = $ScanHistoryTable(this);
  late final $TrackerHistoryTable trackerHistory = $TrackerHistoryTable(this);
  late final $DiscoveryHistoryTable discoveryHistory = $DiscoveryHistoryTable(
    this,
  );
  late final $FavoritesTable favorites = $FavoritesTable(this);
  late final $JobStatusTable jobStatus = $JobStatusTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    notes,
    links,
    tags,
    noteTags,
    linkTags,
    ships,
    shipTags,
    scanHistory,
    trackerHistory,
    discoveryHistory,
    favorites,
    jobStatus,
  ];
  @override
  StreamQueryUpdateRules get streamUpdateRules => const StreamQueryUpdateRules([
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'notes',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('note_tags', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'tags',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('note_tags', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'links',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('link_tags', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'tags',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('link_tags', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'ships',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('ship_tags', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'tags',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('ship_tags', kind: UpdateKind.delete)],
    ),
  ]);
}

typedef $$NotesTableCreateCompanionBuilder =
    NotesCompanion Function({
      required String id,
      Value<String> title,
      Value<String> body,
      required DateTime createdAt,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$NotesTableUpdateCompanionBuilder =
    NotesCompanion Function({
      Value<String> id,
      Value<String> title,
      Value<String> body,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

final class $$NotesTableReferences
    extends BaseReferences<_$AppDatabase, $NotesTable, Note> {
  $$NotesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$NoteTagsTable, List<NoteTag>> _noteTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.noteTags,
    aliasName: $_aliasNameGenerator(db.notes.id, db.noteTags.noteId),
  );

  $$NoteTagsTableProcessedTableManager get noteTagsRefs {
    final manager = $$NoteTagsTableTableManager(
      $_db,
      $_db.noteTags,
    ).filter((f) => f.noteId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_noteTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$NotesTableFilterComposer extends Composer<_$AppDatabase, $NotesTable> {
  $$NotesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get body => $composableBuilder(
    column: $table.body,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> noteTagsRefs(
    Expression<bool> Function($$NoteTagsTableFilterComposer f) f,
  ) {
    final $$NoteTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.noteTags,
      getReferencedColumn: (t) => t.noteId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NoteTagsTableFilterComposer(
            $db: $db,
            $table: $db.noteTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$NotesTableOrderingComposer
    extends Composer<_$AppDatabase, $NotesTable> {
  $$NotesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get body => $composableBuilder(
    column: $table.body,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$NotesTableAnnotationComposer
    extends Composer<_$AppDatabase, $NotesTable> {
  $$NotesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get body =>
      $composableBuilder(column: $table.body, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  Expression<T> noteTagsRefs<T extends Object>(
    Expression<T> Function($$NoteTagsTableAnnotationComposer a) f,
  ) {
    final $$NoteTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.noteTags,
      getReferencedColumn: (t) => t.noteId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NoteTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.noteTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$NotesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $NotesTable,
          Note,
          $$NotesTableFilterComposer,
          $$NotesTableOrderingComposer,
          $$NotesTableAnnotationComposer,
          $$NotesTableCreateCompanionBuilder,
          $$NotesTableUpdateCompanionBuilder,
          (Note, $$NotesTableReferences),
          Note,
          PrefetchHooks Function({bool noteTagsRefs})
        > {
  $$NotesTableTableManager(_$AppDatabase db, $NotesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$NotesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$NotesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$NotesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> body = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => NotesCompanion(
                id: id,
                title: title,
                body: body,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String> title = const Value.absent(),
                Value<String> body = const Value.absent(),
                required DateTime createdAt,
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => NotesCompanion.insert(
                id: id,
                title: title,
                body: body,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) =>
                    (e.readTable(table), $$NotesTableReferences(db, table, e)),
              )
              .toList(),
          prefetchHooksCallback: ({noteTagsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (noteTagsRefs) db.noteTags],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (noteTagsRefs)
                    await $_getPrefetchedData<Note, $NotesTable, NoteTag>(
                      currentTable: table,
                      referencedTable: $$NotesTableReferences
                          ._noteTagsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$NotesTableReferences(db, table, p0).noteTagsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.noteId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$NotesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $NotesTable,
      Note,
      $$NotesTableFilterComposer,
      $$NotesTableOrderingComposer,
      $$NotesTableAnnotationComposer,
      $$NotesTableCreateCompanionBuilder,
      $$NotesTableUpdateCompanionBuilder,
      (Note, $$NotesTableReferences),
      Note,
      PrefetchHooks Function({bool noteTagsRefs})
    >;
typedef $$LinksTableCreateCompanionBuilder =
    LinksCompanion Function({
      required String id,
      Value<String> title,
      Value<String> url,
      Value<String> note,
      required DateTime createdAt,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$LinksTableUpdateCompanionBuilder =
    LinksCompanion Function({
      Value<String> id,
      Value<String> title,
      Value<String> url,
      Value<String> note,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

final class $$LinksTableReferences
    extends BaseReferences<_$AppDatabase, $LinksTable, Link> {
  $$LinksTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$LinkTagsTable, List<LinkTag>> _linkTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.linkTags,
    aliasName: $_aliasNameGenerator(db.links.id, db.linkTags.linkId),
  );

  $$LinkTagsTableProcessedTableManager get linkTagsRefs {
    final manager = $$LinkTagsTableTableManager(
      $_db,
      $_db.linkTags,
    ).filter((f) => f.linkId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_linkTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$LinksTableFilterComposer extends Composer<_$AppDatabase, $LinksTable> {
  $$LinksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get url => $composableBuilder(
    column: $table.url,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> linkTagsRefs(
    Expression<bool> Function($$LinkTagsTableFilterComposer f) f,
  ) {
    final $$LinkTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.linkTags,
      getReferencedColumn: (t) => t.linkId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinkTagsTableFilterComposer(
            $db: $db,
            $table: $db.linkTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$LinksTableOrderingComposer
    extends Composer<_$AppDatabase, $LinksTable> {
  $$LinksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get url => $composableBuilder(
    column: $table.url,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LinksTableAnnotationComposer
    extends Composer<_$AppDatabase, $LinksTable> {
  $$LinksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get url =>
      $composableBuilder(column: $table.url, builder: (column) => column);

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  Expression<T> linkTagsRefs<T extends Object>(
    Expression<T> Function($$LinkTagsTableAnnotationComposer a) f,
  ) {
    final $$LinkTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.linkTags,
      getReferencedColumn: (t) => t.linkId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinkTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.linkTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$LinksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LinksTable,
          Link,
          $$LinksTableFilterComposer,
          $$LinksTableOrderingComposer,
          $$LinksTableAnnotationComposer,
          $$LinksTableCreateCompanionBuilder,
          $$LinksTableUpdateCompanionBuilder,
          (Link, $$LinksTableReferences),
          Link,
          PrefetchHooks Function({bool linkTagsRefs})
        > {
  $$LinksTableTableManager(_$AppDatabase db, $LinksTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LinksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LinksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LinksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> url = const Value.absent(),
                Value<String> note = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LinksCompanion(
                id: id,
                title: title,
                url: url,
                note: note,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String> title = const Value.absent(),
                Value<String> url = const Value.absent(),
                Value<String> note = const Value.absent(),
                required DateTime createdAt,
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => LinksCompanion.insert(
                id: id,
                title: title,
                url: url,
                note: note,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) =>
                    (e.readTable(table), $$LinksTableReferences(db, table, e)),
              )
              .toList(),
          prefetchHooksCallback: ({linkTagsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (linkTagsRefs) db.linkTags],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (linkTagsRefs)
                    await $_getPrefetchedData<Link, $LinksTable, LinkTag>(
                      currentTable: table,
                      referencedTable: $$LinksTableReferences
                          ._linkTagsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$LinksTableReferences(db, table, p0).linkTagsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.linkId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$LinksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LinksTable,
      Link,
      $$LinksTableFilterComposer,
      $$LinksTableOrderingComposer,
      $$LinksTableAnnotationComposer,
      $$LinksTableCreateCompanionBuilder,
      $$LinksTableUpdateCompanionBuilder,
      (Link, $$LinksTableReferences),
      Link,
      PrefetchHooks Function({bool linkTagsRefs})
    >;
typedef $$TagsTableCreateCompanionBuilder =
    TagsCompanion Function({
      required String id,
      required String displayName,
      required String name,
      Value<String?> colorHex,
      Value<int> rowid,
    });
typedef $$TagsTableUpdateCompanionBuilder =
    TagsCompanion Function({
      Value<String> id,
      Value<String> displayName,
      Value<String> name,
      Value<String?> colorHex,
      Value<int> rowid,
    });

final class $$TagsTableReferences
    extends BaseReferences<_$AppDatabase, $TagsTable, Tag> {
  $$TagsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$NoteTagsTable, List<NoteTag>> _noteTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.noteTags,
    aliasName: $_aliasNameGenerator(db.tags.id, db.noteTags.tagId),
  );

  $$NoteTagsTableProcessedTableManager get noteTagsRefs {
    final manager = $$NoteTagsTableTableManager(
      $_db,
      $_db.noteTags,
    ).filter((f) => f.tagId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_noteTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$LinkTagsTable, List<LinkTag>> _linkTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.linkTags,
    aliasName: $_aliasNameGenerator(db.tags.id, db.linkTags.tagId),
  );

  $$LinkTagsTableProcessedTableManager get linkTagsRefs {
    final manager = $$LinkTagsTableTableManager(
      $_db,
      $_db.linkTags,
    ).filter((f) => f.tagId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_linkTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$ShipTagsTable, List<ShipTag>> _shipTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.shipTags,
    aliasName: $_aliasNameGenerator(db.tags.id, db.shipTags.tagId),
  );

  $$ShipTagsTableProcessedTableManager get shipTagsRefs {
    final manager = $$ShipTagsTableTableManager(
      $_db,
      $_db.shipTags,
    ).filter((f) => f.tagId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_shipTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$TagsTableFilterComposer extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get colorHex => $composableBuilder(
    column: $table.colorHex,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> noteTagsRefs(
    Expression<bool> Function($$NoteTagsTableFilterComposer f) f,
  ) {
    final $$NoteTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.noteTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NoteTagsTableFilterComposer(
            $db: $db,
            $table: $db.noteTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> linkTagsRefs(
    Expression<bool> Function($$LinkTagsTableFilterComposer f) f,
  ) {
    final $$LinkTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.linkTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinkTagsTableFilterComposer(
            $db: $db,
            $table: $db.linkTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> shipTagsRefs(
    Expression<bool> Function($$ShipTagsTableFilterComposer f) f,
  ) {
    final $$ShipTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.shipTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipTagsTableFilterComposer(
            $db: $db,
            $table: $db.shipTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$TagsTableOrderingComposer extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get colorHex => $composableBuilder(
    column: $table.colorHex,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $TagsTable> {
  $$TagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get colorHex =>
      $composableBuilder(column: $table.colorHex, builder: (column) => column);

  Expression<T> noteTagsRefs<T extends Object>(
    Expression<T> Function($$NoteTagsTableAnnotationComposer a) f,
  ) {
    final $$NoteTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.noteTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NoteTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.noteTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> linkTagsRefs<T extends Object>(
    Expression<T> Function($$LinkTagsTableAnnotationComposer a) f,
  ) {
    final $$LinkTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.linkTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinkTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.linkTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> shipTagsRefs<T extends Object>(
    Expression<T> Function($$ShipTagsTableAnnotationComposer a) f,
  ) {
    final $$ShipTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.shipTags,
      getReferencedColumn: (t) => t.tagId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.shipTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$TagsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TagsTable,
          Tag,
          $$TagsTableFilterComposer,
          $$TagsTableOrderingComposer,
          $$TagsTableAnnotationComposer,
          $$TagsTableCreateCompanionBuilder,
          $$TagsTableUpdateCompanionBuilder,
          (Tag, $$TagsTableReferences),
          Tag,
          PrefetchHooks Function({
            bool noteTagsRefs,
            bool linkTagsRefs,
            bool shipTagsRefs,
          })
        > {
  $$TagsTableTableManager(_$AppDatabase db, $TagsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> displayName = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> colorHex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TagsCompanion(
                id: id,
                displayName: displayName,
                name: name,
                colorHex: colorHex,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String displayName,
                required String name,
                Value<String?> colorHex = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TagsCompanion.insert(
                id: id,
                displayName: displayName,
                name: name,
                colorHex: colorHex,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) =>
                    (e.readTable(table), $$TagsTableReferences(db, table, e)),
              )
              .toList(),
          prefetchHooksCallback:
              ({
                noteTagsRefs = false,
                linkTagsRefs = false,
                shipTagsRefs = false,
              }) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (noteTagsRefs) db.noteTags,
                    if (linkTagsRefs) db.linkTags,
                    if (shipTagsRefs) db.shipTags,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (noteTagsRefs)
                        await $_getPrefetchedData<Tag, $TagsTable, NoteTag>(
                          currentTable: table,
                          referencedTable: $$TagsTableReferences
                              ._noteTagsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$TagsTableReferences(db, table, p0).noteTagsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.tagId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (linkTagsRefs)
                        await $_getPrefetchedData<Tag, $TagsTable, LinkTag>(
                          currentTable: table,
                          referencedTable: $$TagsTableReferences
                              ._linkTagsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$TagsTableReferences(db, table, p0).linkTagsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.tagId == item.id,
                              ),
                          typedResults: items,
                        ),
                      if (shipTagsRefs)
                        await $_getPrefetchedData<Tag, $TagsTable, ShipTag>(
                          currentTable: table,
                          referencedTable: $$TagsTableReferences
                              ._shipTagsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$TagsTableReferences(db, table, p0).shipTagsRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) => e.tagId == item.id,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$TagsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TagsTable,
      Tag,
      $$TagsTableFilterComposer,
      $$TagsTableOrderingComposer,
      $$TagsTableAnnotationComposer,
      $$TagsTableCreateCompanionBuilder,
      $$TagsTableUpdateCompanionBuilder,
      (Tag, $$TagsTableReferences),
      Tag,
      PrefetchHooks Function({
        bool noteTagsRefs,
        bool linkTagsRefs,
        bool shipTagsRefs,
      })
    >;
typedef $$NoteTagsTableCreateCompanionBuilder =
    NoteTagsCompanion Function({
      required String noteId,
      required String tagId,
      Value<int> rowid,
    });
typedef $$NoteTagsTableUpdateCompanionBuilder =
    NoteTagsCompanion Function({
      Value<String> noteId,
      Value<String> tagId,
      Value<int> rowid,
    });

final class $$NoteTagsTableReferences
    extends BaseReferences<_$AppDatabase, $NoteTagsTable, NoteTag> {
  $$NoteTagsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $NotesTable _noteIdTable(_$AppDatabase db) => db.notes.createAlias(
    $_aliasNameGenerator(db.noteTags.noteId, db.notes.id),
  );

  $$NotesTableProcessedTableManager get noteId {
    final $_column = $_itemColumn<String>('note_id')!;

    final manager = $$NotesTableTableManager(
      $_db,
      $_db.notes,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_noteIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $TagsTable _tagIdTable(_$AppDatabase db) =>
      db.tags.createAlias($_aliasNameGenerator(db.noteTags.tagId, db.tags.id));

  $$TagsTableProcessedTableManager get tagId {
    final $_column = $_itemColumn<String>('tag_id')!;

    final manager = $$TagsTableTableManager(
      $_db,
      $_db.tags,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_tagIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$NoteTagsTableFilterComposer
    extends Composer<_$AppDatabase, $NoteTagsTable> {
  $$NoteTagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$NotesTableFilterComposer get noteId {
    final $$NotesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.noteId,
      referencedTable: $db.notes,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NotesTableFilterComposer(
            $db: $db,
            $table: $db.notes,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableFilterComposer get tagId {
    final $$TagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableFilterComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$NoteTagsTableOrderingComposer
    extends Composer<_$AppDatabase, $NoteTagsTable> {
  $$NoteTagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$NotesTableOrderingComposer get noteId {
    final $$NotesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.noteId,
      referencedTable: $db.notes,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NotesTableOrderingComposer(
            $db: $db,
            $table: $db.notes,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableOrderingComposer get tagId {
    final $$TagsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableOrderingComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$NoteTagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $NoteTagsTable> {
  $$NoteTagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$NotesTableAnnotationComposer get noteId {
    final $$NotesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.noteId,
      referencedTable: $db.notes,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$NotesTableAnnotationComposer(
            $db: $db,
            $table: $db.notes,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableAnnotationComposer get tagId {
    final $$TagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableAnnotationComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$NoteTagsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $NoteTagsTable,
          NoteTag,
          $$NoteTagsTableFilterComposer,
          $$NoteTagsTableOrderingComposer,
          $$NoteTagsTableAnnotationComposer,
          $$NoteTagsTableCreateCompanionBuilder,
          $$NoteTagsTableUpdateCompanionBuilder,
          (NoteTag, $$NoteTagsTableReferences),
          NoteTag,
          PrefetchHooks Function({bool noteId, bool tagId})
        > {
  $$NoteTagsTableTableManager(_$AppDatabase db, $NoteTagsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$NoteTagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$NoteTagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$NoteTagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> noteId = const Value.absent(),
                Value<String> tagId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) =>
                  NoteTagsCompanion(noteId: noteId, tagId: tagId, rowid: rowid),
          createCompanionCallback:
              ({
                required String noteId,
                required String tagId,
                Value<int> rowid = const Value.absent(),
              }) => NoteTagsCompanion.insert(
                noteId: noteId,
                tagId: tagId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$NoteTagsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({noteId = false, tagId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (noteId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.noteId,
                                referencedTable: $$NoteTagsTableReferences
                                    ._noteIdTable(db),
                                referencedColumn: $$NoteTagsTableReferences
                                    ._noteIdTable(db)
                                    .id,
                              )
                              as T;
                    }
                    if (tagId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.tagId,
                                referencedTable: $$NoteTagsTableReferences
                                    ._tagIdTable(db),
                                referencedColumn: $$NoteTagsTableReferences
                                    ._tagIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$NoteTagsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $NoteTagsTable,
      NoteTag,
      $$NoteTagsTableFilterComposer,
      $$NoteTagsTableOrderingComposer,
      $$NoteTagsTableAnnotationComposer,
      $$NoteTagsTableCreateCompanionBuilder,
      $$NoteTagsTableUpdateCompanionBuilder,
      (NoteTag, $$NoteTagsTableReferences),
      NoteTag,
      PrefetchHooks Function({bool noteId, bool tagId})
    >;
typedef $$LinkTagsTableCreateCompanionBuilder =
    LinkTagsCompanion Function({
      required String linkId,
      required String tagId,
      Value<int> rowid,
    });
typedef $$LinkTagsTableUpdateCompanionBuilder =
    LinkTagsCompanion Function({
      Value<String> linkId,
      Value<String> tagId,
      Value<int> rowid,
    });

final class $$LinkTagsTableReferences
    extends BaseReferences<_$AppDatabase, $LinkTagsTable, LinkTag> {
  $$LinkTagsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $LinksTable _linkIdTable(_$AppDatabase db) => db.links.createAlias(
    $_aliasNameGenerator(db.linkTags.linkId, db.links.id),
  );

  $$LinksTableProcessedTableManager get linkId {
    final $_column = $_itemColumn<String>('link_id')!;

    final manager = $$LinksTableTableManager(
      $_db,
      $_db.links,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_linkIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $TagsTable _tagIdTable(_$AppDatabase db) =>
      db.tags.createAlias($_aliasNameGenerator(db.linkTags.tagId, db.tags.id));

  $$TagsTableProcessedTableManager get tagId {
    final $_column = $_itemColumn<String>('tag_id')!;

    final manager = $$TagsTableTableManager(
      $_db,
      $_db.tags,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_tagIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$LinkTagsTableFilterComposer
    extends Composer<_$AppDatabase, $LinkTagsTable> {
  $$LinkTagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$LinksTableFilterComposer get linkId {
    final $$LinksTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.linkId,
      referencedTable: $db.links,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinksTableFilterComposer(
            $db: $db,
            $table: $db.links,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableFilterComposer get tagId {
    final $$TagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableFilterComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$LinkTagsTableOrderingComposer
    extends Composer<_$AppDatabase, $LinkTagsTable> {
  $$LinkTagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$LinksTableOrderingComposer get linkId {
    final $$LinksTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.linkId,
      referencedTable: $db.links,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinksTableOrderingComposer(
            $db: $db,
            $table: $db.links,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableOrderingComposer get tagId {
    final $$TagsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableOrderingComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$LinkTagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LinkTagsTable> {
  $$LinkTagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$LinksTableAnnotationComposer get linkId {
    final $$LinksTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.linkId,
      referencedTable: $db.links,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LinksTableAnnotationComposer(
            $db: $db,
            $table: $db.links,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableAnnotationComposer get tagId {
    final $$TagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableAnnotationComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$LinkTagsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LinkTagsTable,
          LinkTag,
          $$LinkTagsTableFilterComposer,
          $$LinkTagsTableOrderingComposer,
          $$LinkTagsTableAnnotationComposer,
          $$LinkTagsTableCreateCompanionBuilder,
          $$LinkTagsTableUpdateCompanionBuilder,
          (LinkTag, $$LinkTagsTableReferences),
          LinkTag,
          PrefetchHooks Function({bool linkId, bool tagId})
        > {
  $$LinkTagsTableTableManager(_$AppDatabase db, $LinkTagsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LinkTagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LinkTagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LinkTagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> linkId = const Value.absent(),
                Value<String> tagId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) =>
                  LinkTagsCompanion(linkId: linkId, tagId: tagId, rowid: rowid),
          createCompanionCallback:
              ({
                required String linkId,
                required String tagId,
                Value<int> rowid = const Value.absent(),
              }) => LinkTagsCompanion.insert(
                linkId: linkId,
                tagId: tagId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$LinkTagsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({linkId = false, tagId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (linkId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.linkId,
                                referencedTable: $$LinkTagsTableReferences
                                    ._linkIdTable(db),
                                referencedColumn: $$LinkTagsTableReferences
                                    ._linkIdTable(db)
                                    .id,
                              )
                              as T;
                    }
                    if (tagId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.tagId,
                                referencedTable: $$LinkTagsTableReferences
                                    ._tagIdTable(db),
                                referencedColumn: $$LinkTagsTableReferences
                                    ._tagIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$LinkTagsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LinkTagsTable,
      LinkTag,
      $$LinkTagsTableFilterComposer,
      $$LinkTagsTableOrderingComposer,
      $$LinkTagsTableAnnotationComposer,
      $$LinkTagsTableCreateCompanionBuilder,
      $$LinkTagsTableUpdateCompanionBuilder,
      (LinkTag, $$LinkTagsTableReferences),
      LinkTag,
      PrefetchHooks Function({bool linkId, bool tagId})
    >;
typedef $$ShipsTableCreateCompanionBuilder =
    ShipsCompanion Function({
      required String id,
      Value<String> name,
      Value<String?> modelKey,
      Value<String?> customModelLabel,
      Value<bool> registered,
      Value<String?> locationKey,
      Value<String?> customLocation,
      Value<int?> locationZone,
      Value<String?> locationSector,
      Value<int?> locationSL,
      Value<int?> hull,
      Value<String?> pilotName,
      Value<String?> gunnerName,
      Value<String?> cartographerName,
      Value<String?> prospectorName,
      Value<String?> signallerName,
      Value<String?> technicianName,
      Value<String?> sentryName,
      Value<String?> fabricatorName,
      Value<String?> medicName,
      Value<String?> quartermasterName,
      Value<String?> chefName,
      Value<String?> alchemistName,
      Value<String> note,
      required DateTime createdAt,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$ShipsTableUpdateCompanionBuilder =
    ShipsCompanion Function({
      Value<String> id,
      Value<String> name,
      Value<String?> modelKey,
      Value<String?> customModelLabel,
      Value<bool> registered,
      Value<String?> locationKey,
      Value<String?> customLocation,
      Value<int?> locationZone,
      Value<String?> locationSector,
      Value<int?> locationSL,
      Value<int?> hull,
      Value<String?> pilotName,
      Value<String?> gunnerName,
      Value<String?> cartographerName,
      Value<String?> prospectorName,
      Value<String?> signallerName,
      Value<String?> technicianName,
      Value<String?> sentryName,
      Value<String?> fabricatorName,
      Value<String?> medicName,
      Value<String?> quartermasterName,
      Value<String?> chefName,
      Value<String?> alchemistName,
      Value<String> note,
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

final class $$ShipsTableReferences
    extends BaseReferences<_$AppDatabase, $ShipsTable, Ship> {
  $$ShipsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$ShipTagsTable, List<ShipTag>> _shipTagsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.shipTags,
    aliasName: $_aliasNameGenerator(db.ships.id, db.shipTags.shipId),
  );

  $$ShipTagsTableProcessedTableManager get shipTagsRefs {
    final manager = $$ShipTagsTableTableManager(
      $_db,
      $_db.shipTags,
    ).filter((f) => f.shipId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_shipTagsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$ShipsTableFilterComposer extends Composer<_$AppDatabase, $ShipsTable> {
  $$ShipsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get modelKey => $composableBuilder(
    column: $table.modelKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get customModelLabel => $composableBuilder(
    column: $table.customModelLabel,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get registered => $composableBuilder(
    column: $table.registered,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationKey => $composableBuilder(
    column: $table.locationKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get customLocation => $composableBuilder(
    column: $table.customLocation,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get locationZone => $composableBuilder(
    column: $table.locationZone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get locationSector => $composableBuilder(
    column: $table.locationSector,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get locationSL => $composableBuilder(
    column: $table.locationSL,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get hull => $composableBuilder(
    column: $table.hull,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get pilotName => $composableBuilder(
    column: $table.pilotName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get gunnerName => $composableBuilder(
    column: $table.gunnerName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cartographerName => $composableBuilder(
    column: $table.cartographerName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get prospectorName => $composableBuilder(
    column: $table.prospectorName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get signallerName => $composableBuilder(
    column: $table.signallerName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get technicianName => $composableBuilder(
    column: $table.technicianName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sentryName => $composableBuilder(
    column: $table.sentryName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fabricatorName => $composableBuilder(
    column: $table.fabricatorName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get medicName => $composableBuilder(
    column: $table.medicName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get quartermasterName => $composableBuilder(
    column: $table.quartermasterName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get chefName => $composableBuilder(
    column: $table.chefName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get alchemistName => $composableBuilder(
    column: $table.alchemistName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> shipTagsRefs(
    Expression<bool> Function($$ShipTagsTableFilterComposer f) f,
  ) {
    final $$ShipTagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.shipTags,
      getReferencedColumn: (t) => t.shipId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipTagsTableFilterComposer(
            $db: $db,
            $table: $db.shipTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ShipsTableOrderingComposer
    extends Composer<_$AppDatabase, $ShipsTable> {
  $$ShipsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get modelKey => $composableBuilder(
    column: $table.modelKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get customModelLabel => $composableBuilder(
    column: $table.customModelLabel,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get registered => $composableBuilder(
    column: $table.registered,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationKey => $composableBuilder(
    column: $table.locationKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get customLocation => $composableBuilder(
    column: $table.customLocation,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get locationZone => $composableBuilder(
    column: $table.locationZone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get locationSector => $composableBuilder(
    column: $table.locationSector,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get locationSL => $composableBuilder(
    column: $table.locationSL,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get hull => $composableBuilder(
    column: $table.hull,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get pilotName => $composableBuilder(
    column: $table.pilotName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get gunnerName => $composableBuilder(
    column: $table.gunnerName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cartographerName => $composableBuilder(
    column: $table.cartographerName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get prospectorName => $composableBuilder(
    column: $table.prospectorName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get signallerName => $composableBuilder(
    column: $table.signallerName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get technicianName => $composableBuilder(
    column: $table.technicianName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sentryName => $composableBuilder(
    column: $table.sentryName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fabricatorName => $composableBuilder(
    column: $table.fabricatorName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get medicName => $composableBuilder(
    column: $table.medicName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get quartermasterName => $composableBuilder(
    column: $table.quartermasterName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get chefName => $composableBuilder(
    column: $table.chefName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get alchemistName => $composableBuilder(
    column: $table.alchemistName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ShipsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ShipsTable> {
  $$ShipsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get modelKey =>
      $composableBuilder(column: $table.modelKey, builder: (column) => column);

  GeneratedColumn<String> get customModelLabel => $composableBuilder(
    column: $table.customModelLabel,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get registered => $composableBuilder(
    column: $table.registered,
    builder: (column) => column,
  );

  GeneratedColumn<String> get locationKey => $composableBuilder(
    column: $table.locationKey,
    builder: (column) => column,
  );

  GeneratedColumn<String> get customLocation => $composableBuilder(
    column: $table.customLocation,
    builder: (column) => column,
  );

  GeneratedColumn<int> get locationZone => $composableBuilder(
    column: $table.locationZone,
    builder: (column) => column,
  );

  GeneratedColumn<String> get locationSector => $composableBuilder(
    column: $table.locationSector,
    builder: (column) => column,
  );

  GeneratedColumn<int> get locationSL => $composableBuilder(
    column: $table.locationSL,
    builder: (column) => column,
  );

  GeneratedColumn<int> get hull =>
      $composableBuilder(column: $table.hull, builder: (column) => column);

  GeneratedColumn<String> get pilotName =>
      $composableBuilder(column: $table.pilotName, builder: (column) => column);

  GeneratedColumn<String> get gunnerName => $composableBuilder(
    column: $table.gunnerName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get cartographerName => $composableBuilder(
    column: $table.cartographerName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get prospectorName => $composableBuilder(
    column: $table.prospectorName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get signallerName => $composableBuilder(
    column: $table.signallerName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get technicianName => $composableBuilder(
    column: $table.technicianName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sentryName => $composableBuilder(
    column: $table.sentryName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get fabricatorName => $composableBuilder(
    column: $table.fabricatorName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get medicName =>
      $composableBuilder(column: $table.medicName, builder: (column) => column);

  GeneratedColumn<String> get quartermasterName => $composableBuilder(
    column: $table.quartermasterName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get chefName =>
      $composableBuilder(column: $table.chefName, builder: (column) => column);

  GeneratedColumn<String> get alchemistName => $composableBuilder(
    column: $table.alchemistName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  Expression<T> shipTagsRefs<T extends Object>(
    Expression<T> Function($$ShipTagsTableAnnotationComposer a) f,
  ) {
    final $$ShipTagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.shipTags,
      getReferencedColumn: (t) => t.shipId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipTagsTableAnnotationComposer(
            $db: $db,
            $table: $db.shipTags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ShipsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ShipsTable,
          Ship,
          $$ShipsTableFilterComposer,
          $$ShipsTableOrderingComposer,
          $$ShipsTableAnnotationComposer,
          $$ShipsTableCreateCompanionBuilder,
          $$ShipsTableUpdateCompanionBuilder,
          (Ship, $$ShipsTableReferences),
          Ship,
          PrefetchHooks Function({bool shipTagsRefs})
        > {
  $$ShipsTableTableManager(_$AppDatabase db, $ShipsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ShipsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ShipsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ShipsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> modelKey = const Value.absent(),
                Value<String?> customModelLabel = const Value.absent(),
                Value<bool> registered = const Value.absent(),
                Value<String?> locationKey = const Value.absent(),
                Value<String?> customLocation = const Value.absent(),
                Value<int?> locationZone = const Value.absent(),
                Value<String?> locationSector = const Value.absent(),
                Value<int?> locationSL = const Value.absent(),
                Value<int?> hull = const Value.absent(),
                Value<String?> pilotName = const Value.absent(),
                Value<String?> gunnerName = const Value.absent(),
                Value<String?> cartographerName = const Value.absent(),
                Value<String?> prospectorName = const Value.absent(),
                Value<String?> signallerName = const Value.absent(),
                Value<String?> technicianName = const Value.absent(),
                Value<String?> sentryName = const Value.absent(),
                Value<String?> fabricatorName = const Value.absent(),
                Value<String?> medicName = const Value.absent(),
                Value<String?> quartermasterName = const Value.absent(),
                Value<String?> chefName = const Value.absent(),
                Value<String?> alchemistName = const Value.absent(),
                Value<String> note = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ShipsCompanion(
                id: id,
                name: name,
                modelKey: modelKey,
                customModelLabel: customModelLabel,
                registered: registered,
                locationKey: locationKey,
                customLocation: customLocation,
                locationZone: locationZone,
                locationSector: locationSector,
                locationSL: locationSL,
                hull: hull,
                pilotName: pilotName,
                gunnerName: gunnerName,
                cartographerName: cartographerName,
                prospectorName: prospectorName,
                signallerName: signallerName,
                technicianName: technicianName,
                sentryName: sentryName,
                fabricatorName: fabricatorName,
                medicName: medicName,
                quartermasterName: quartermasterName,
                chefName: chefName,
                alchemistName: alchemistName,
                note: note,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String> name = const Value.absent(),
                Value<String?> modelKey = const Value.absent(),
                Value<String?> customModelLabel = const Value.absent(),
                Value<bool> registered = const Value.absent(),
                Value<String?> locationKey = const Value.absent(),
                Value<String?> customLocation = const Value.absent(),
                Value<int?> locationZone = const Value.absent(),
                Value<String?> locationSector = const Value.absent(),
                Value<int?> locationSL = const Value.absent(),
                Value<int?> hull = const Value.absent(),
                Value<String?> pilotName = const Value.absent(),
                Value<String?> gunnerName = const Value.absent(),
                Value<String?> cartographerName = const Value.absent(),
                Value<String?> prospectorName = const Value.absent(),
                Value<String?> signallerName = const Value.absent(),
                Value<String?> technicianName = const Value.absent(),
                Value<String?> sentryName = const Value.absent(),
                Value<String?> fabricatorName = const Value.absent(),
                Value<String?> medicName = const Value.absent(),
                Value<String?> quartermasterName = const Value.absent(),
                Value<String?> chefName = const Value.absent(),
                Value<String?> alchemistName = const Value.absent(),
                Value<String> note = const Value.absent(),
                required DateTime createdAt,
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => ShipsCompanion.insert(
                id: id,
                name: name,
                modelKey: modelKey,
                customModelLabel: customModelLabel,
                registered: registered,
                locationKey: locationKey,
                customLocation: customLocation,
                locationZone: locationZone,
                locationSector: locationSector,
                locationSL: locationSL,
                hull: hull,
                pilotName: pilotName,
                gunnerName: gunnerName,
                cartographerName: cartographerName,
                prospectorName: prospectorName,
                signallerName: signallerName,
                technicianName: technicianName,
                sentryName: sentryName,
                fabricatorName: fabricatorName,
                medicName: medicName,
                quartermasterName: quartermasterName,
                chefName: chefName,
                alchemistName: alchemistName,
                note: note,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) =>
                    (e.readTable(table), $$ShipsTableReferences(db, table, e)),
              )
              .toList(),
          prefetchHooksCallback: ({shipTagsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (shipTagsRefs) db.shipTags],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (shipTagsRefs)
                    await $_getPrefetchedData<Ship, $ShipsTable, ShipTag>(
                      currentTable: table,
                      referencedTable: $$ShipsTableReferences
                          ._shipTagsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$ShipsTableReferences(db, table, p0).shipTagsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.shipId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$ShipsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ShipsTable,
      Ship,
      $$ShipsTableFilterComposer,
      $$ShipsTableOrderingComposer,
      $$ShipsTableAnnotationComposer,
      $$ShipsTableCreateCompanionBuilder,
      $$ShipsTableUpdateCompanionBuilder,
      (Ship, $$ShipsTableReferences),
      Ship,
      PrefetchHooks Function({bool shipTagsRefs})
    >;
typedef $$ShipTagsTableCreateCompanionBuilder =
    ShipTagsCompanion Function({
      required String shipId,
      required String tagId,
      Value<int> rowid,
    });
typedef $$ShipTagsTableUpdateCompanionBuilder =
    ShipTagsCompanion Function({
      Value<String> shipId,
      Value<String> tagId,
      Value<int> rowid,
    });

final class $$ShipTagsTableReferences
    extends BaseReferences<_$AppDatabase, $ShipTagsTable, ShipTag> {
  $$ShipTagsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $ShipsTable _shipIdTable(_$AppDatabase db) => db.ships.createAlias(
    $_aliasNameGenerator(db.shipTags.shipId, db.ships.id),
  );

  $$ShipsTableProcessedTableManager get shipId {
    final $_column = $_itemColumn<String>('ship_id')!;

    final manager = $$ShipsTableTableManager(
      $_db,
      $_db.ships,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_shipIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $TagsTable _tagIdTable(_$AppDatabase db) =>
      db.tags.createAlias($_aliasNameGenerator(db.shipTags.tagId, db.tags.id));

  $$TagsTableProcessedTableManager get tagId {
    final $_column = $_itemColumn<String>('tag_id')!;

    final manager = $$TagsTableTableManager(
      $_db,
      $_db.tags,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_tagIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$ShipTagsTableFilterComposer
    extends Composer<_$AppDatabase, $ShipTagsTable> {
  $$ShipTagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$ShipsTableFilterComposer get shipId {
    final $$ShipsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.shipId,
      referencedTable: $db.ships,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipsTableFilterComposer(
            $db: $db,
            $table: $db.ships,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableFilterComposer get tagId {
    final $$TagsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableFilterComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ShipTagsTableOrderingComposer
    extends Composer<_$AppDatabase, $ShipTagsTable> {
  $$ShipTagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$ShipsTableOrderingComposer get shipId {
    final $$ShipsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.shipId,
      referencedTable: $db.ships,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipsTableOrderingComposer(
            $db: $db,
            $table: $db.ships,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableOrderingComposer get tagId {
    final $$TagsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableOrderingComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ShipTagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ShipTagsTable> {
  $$ShipTagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  $$ShipsTableAnnotationComposer get shipId {
    final $$ShipsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.shipId,
      referencedTable: $db.ships,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ShipsTableAnnotationComposer(
            $db: $db,
            $table: $db.ships,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$TagsTableAnnotationComposer get tagId {
    final $$TagsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.tagId,
      referencedTable: $db.tags,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$TagsTableAnnotationComposer(
            $db: $db,
            $table: $db.tags,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$ShipTagsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ShipTagsTable,
          ShipTag,
          $$ShipTagsTableFilterComposer,
          $$ShipTagsTableOrderingComposer,
          $$ShipTagsTableAnnotationComposer,
          $$ShipTagsTableCreateCompanionBuilder,
          $$ShipTagsTableUpdateCompanionBuilder,
          (ShipTag, $$ShipTagsTableReferences),
          ShipTag,
          PrefetchHooks Function({bool shipId, bool tagId})
        > {
  $$ShipTagsTableTableManager(_$AppDatabase db, $ShipTagsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ShipTagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ShipTagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ShipTagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> shipId = const Value.absent(),
                Value<String> tagId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) =>
                  ShipTagsCompanion(shipId: shipId, tagId: tagId, rowid: rowid),
          createCompanionCallback:
              ({
                required String shipId,
                required String tagId,
                Value<int> rowid = const Value.absent(),
              }) => ShipTagsCompanion.insert(
                shipId: shipId,
                tagId: tagId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ShipTagsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({shipId = false, tagId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (shipId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.shipId,
                                referencedTable: $$ShipTagsTableReferences
                                    ._shipIdTable(db),
                                referencedColumn: $$ShipTagsTableReferences
                                    ._shipIdTable(db)
                                    .id,
                              )
                              as T;
                    }
                    if (tagId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.tagId,
                                referencedTable: $$ShipTagsTableReferences
                                    ._tagIdTable(db),
                                referencedColumn: $$ShipTagsTableReferences
                                    ._tagIdTable(db)
                                    .id,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$ShipTagsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ShipTagsTable,
      ShipTag,
      $$ShipTagsTableFilterComposer,
      $$ShipTagsTableOrderingComposer,
      $$ShipTagsTableAnnotationComposer,
      $$ShipTagsTableCreateCompanionBuilder,
      $$ShipTagsTableUpdateCompanionBuilder,
      (ShipTag, $$ShipTagsTableReferences),
      ShipTag,
      PrefetchHooks Function({bool shipId, bool tagId})
    >;
typedef $$ScanHistoryTableCreateCompanionBuilder =
    ScanHistoryCompanion Function({
      required String id,
      required DateTime date,
      required String mode,
      required String payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });
typedef $$ScanHistoryTableUpdateCompanionBuilder =
    ScanHistoryCompanion Function({
      Value<String> id,
      Value<DateTime> date,
      Value<String> mode,
      Value<String> payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });

class $$ScanHistoryTableFilterComposer
    extends Composer<_$AppDatabase, $ScanHistoryTable> {
  $$ScanHistoryTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ScanHistoryTableOrderingComposer
    extends Composer<_$AppDatabase, $ScanHistoryTable> {
  $$ScanHistoryTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ScanHistoryTableAnnotationComposer
    extends Composer<_$AppDatabase, $ScanHistoryTable> {
  $$ScanHistoryTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get mode =>
      $composableBuilder(column: $table.mode, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get errored =>
      $composableBuilder(column: $table.errored, builder: (column) => column);
}

class $$ScanHistoryTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ScanHistoryTable,
          ScanHistoryData,
          $$ScanHistoryTableFilterComposer,
          $$ScanHistoryTableOrderingComposer,
          $$ScanHistoryTableAnnotationComposer,
          $$ScanHistoryTableCreateCompanionBuilder,
          $$ScanHistoryTableUpdateCompanionBuilder,
          (
            ScanHistoryData,
            BaseReferences<_$AppDatabase, $ScanHistoryTable, ScanHistoryData>,
          ),
          ScanHistoryData,
          PrefetchHooks Function()
        > {
  $$ScanHistoryTableTableManager(_$AppDatabase db, $ScanHistoryTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ScanHistoryTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ScanHistoryTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ScanHistoryTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<DateTime> date = const Value.absent(),
                Value<String> mode = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ScanHistoryCompanion(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required DateTime date,
                required String mode,
                required String payloadJson,
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ScanHistoryCompanion.insert(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ScanHistoryTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ScanHistoryTable,
      ScanHistoryData,
      $$ScanHistoryTableFilterComposer,
      $$ScanHistoryTableOrderingComposer,
      $$ScanHistoryTableAnnotationComposer,
      $$ScanHistoryTableCreateCompanionBuilder,
      $$ScanHistoryTableUpdateCompanionBuilder,
      (
        ScanHistoryData,
        BaseReferences<_$AppDatabase, $ScanHistoryTable, ScanHistoryData>,
      ),
      ScanHistoryData,
      PrefetchHooks Function()
    >;
typedef $$TrackerHistoryTableCreateCompanionBuilder =
    TrackerHistoryCompanion Function({
      required String id,
      required DateTime date,
      required String mode,
      required String payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });
typedef $$TrackerHistoryTableUpdateCompanionBuilder =
    TrackerHistoryCompanion Function({
      Value<String> id,
      Value<DateTime> date,
      Value<String> mode,
      Value<String> payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });

class $$TrackerHistoryTableFilterComposer
    extends Composer<_$AppDatabase, $TrackerHistoryTable> {
  $$TrackerHistoryTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TrackerHistoryTableOrderingComposer
    extends Composer<_$AppDatabase, $TrackerHistoryTable> {
  $$TrackerHistoryTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TrackerHistoryTableAnnotationComposer
    extends Composer<_$AppDatabase, $TrackerHistoryTable> {
  $$TrackerHistoryTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get mode =>
      $composableBuilder(column: $table.mode, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get errored =>
      $composableBuilder(column: $table.errored, builder: (column) => column);
}

class $$TrackerHistoryTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $TrackerHistoryTable,
          TrackerHistoryData,
          $$TrackerHistoryTableFilterComposer,
          $$TrackerHistoryTableOrderingComposer,
          $$TrackerHistoryTableAnnotationComposer,
          $$TrackerHistoryTableCreateCompanionBuilder,
          $$TrackerHistoryTableUpdateCompanionBuilder,
          (
            TrackerHistoryData,
            BaseReferences<
              _$AppDatabase,
              $TrackerHistoryTable,
              TrackerHistoryData
            >,
          ),
          TrackerHistoryData,
          PrefetchHooks Function()
        > {
  $$TrackerHistoryTableTableManager(
    _$AppDatabase db,
    $TrackerHistoryTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TrackerHistoryTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TrackerHistoryTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TrackerHistoryTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<DateTime> date = const Value.absent(),
                Value<String> mode = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TrackerHistoryCompanion(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required DateTime date,
                required String mode,
                required String payloadJson,
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TrackerHistoryCompanion.insert(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TrackerHistoryTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $TrackerHistoryTable,
      TrackerHistoryData,
      $$TrackerHistoryTableFilterComposer,
      $$TrackerHistoryTableOrderingComposer,
      $$TrackerHistoryTableAnnotationComposer,
      $$TrackerHistoryTableCreateCompanionBuilder,
      $$TrackerHistoryTableUpdateCompanionBuilder,
      (
        TrackerHistoryData,
        BaseReferences<_$AppDatabase, $TrackerHistoryTable, TrackerHistoryData>,
      ),
      TrackerHistoryData,
      PrefetchHooks Function()
    >;
typedef $$DiscoveryHistoryTableCreateCompanionBuilder =
    DiscoveryHistoryCompanion Function({
      required String id,
      required DateTime date,
      required String mode,
      required String payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });
typedef $$DiscoveryHistoryTableUpdateCompanionBuilder =
    DiscoveryHistoryCompanion Function({
      Value<String> id,
      Value<DateTime> date,
      Value<String> mode,
      Value<String> payloadJson,
      Value<bool> errored,
      Value<int> rowid,
    });

class $$DiscoveryHistoryTableFilterComposer
    extends Composer<_$AppDatabase, $DiscoveryHistoryTable> {
  $$DiscoveryHistoryTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DiscoveryHistoryTableOrderingComposer
    extends Composer<_$AppDatabase, $DiscoveryHistoryTable> {
  $$DiscoveryHistoryTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get errored => $composableBuilder(
    column: $table.errored,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DiscoveryHistoryTableAnnotationComposer
    extends Composer<_$AppDatabase, $DiscoveryHistoryTable> {
  $$DiscoveryHistoryTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get mode =>
      $composableBuilder(column: $table.mode, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get errored =>
      $composableBuilder(column: $table.errored, builder: (column) => column);
}

class $$DiscoveryHistoryTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DiscoveryHistoryTable,
          DiscoveryHistoryData,
          $$DiscoveryHistoryTableFilterComposer,
          $$DiscoveryHistoryTableOrderingComposer,
          $$DiscoveryHistoryTableAnnotationComposer,
          $$DiscoveryHistoryTableCreateCompanionBuilder,
          $$DiscoveryHistoryTableUpdateCompanionBuilder,
          (
            DiscoveryHistoryData,
            BaseReferences<
              _$AppDatabase,
              $DiscoveryHistoryTable,
              DiscoveryHistoryData
            >,
          ),
          DiscoveryHistoryData,
          PrefetchHooks Function()
        > {
  $$DiscoveryHistoryTableTableManager(
    _$AppDatabase db,
    $DiscoveryHistoryTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DiscoveryHistoryTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DiscoveryHistoryTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DiscoveryHistoryTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<DateTime> date = const Value.absent(),
                Value<String> mode = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DiscoveryHistoryCompanion(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required DateTime date,
                required String mode,
                required String payloadJson,
                Value<bool> errored = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DiscoveryHistoryCompanion.insert(
                id: id,
                date: date,
                mode: mode,
                payloadJson: payloadJson,
                errored: errored,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DiscoveryHistoryTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DiscoveryHistoryTable,
      DiscoveryHistoryData,
      $$DiscoveryHistoryTableFilterComposer,
      $$DiscoveryHistoryTableOrderingComposer,
      $$DiscoveryHistoryTableAnnotationComposer,
      $$DiscoveryHistoryTableCreateCompanionBuilder,
      $$DiscoveryHistoryTableUpdateCompanionBuilder,
      (
        DiscoveryHistoryData,
        BaseReferences<
          _$AppDatabase,
          $DiscoveryHistoryTable,
          DiscoveryHistoryData
        >,
      ),
      DiscoveryHistoryData,
      PrefetchHooks Function()
    >;
typedef $$FavoritesTableCreateCompanionBuilder =
    FavoritesCompanion Function({
      required String entityType,
      required String entityId,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$FavoritesTableUpdateCompanionBuilder =
    FavoritesCompanion Function({
      Value<String> entityType,
      Value<String> entityId,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$FavoritesTableFilterComposer
    extends Composer<_$AppDatabase, $FavoritesTable> {
  $$FavoritesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$FavoritesTableOrderingComposer
    extends Composer<_$AppDatabase, $FavoritesTable> {
  $$FavoritesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$FavoritesTableAnnotationComposer
    extends Composer<_$AppDatabase, $FavoritesTable> {
  $$FavoritesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$FavoritesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $FavoritesTable,
          Favorite,
          $$FavoritesTableFilterComposer,
          $$FavoritesTableOrderingComposer,
          $$FavoritesTableAnnotationComposer,
          $$FavoritesTableCreateCompanionBuilder,
          $$FavoritesTableUpdateCompanionBuilder,
          (Favorite, BaseReferences<_$AppDatabase, $FavoritesTable, Favorite>),
          Favorite,
          PrefetchHooks Function()
        > {
  $$FavoritesTableTableManager(_$AppDatabase db, $FavoritesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$FavoritesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$FavoritesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$FavoritesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> entityType = const Value.absent(),
                Value<String> entityId = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => FavoritesCompanion(
                entityType: entityType,
                entityId: entityId,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String entityType,
                required String entityId,
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => FavoritesCompanion.insert(
                entityType: entityType,
                entityId: entityId,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$FavoritesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $FavoritesTable,
      Favorite,
      $$FavoritesTableFilterComposer,
      $$FavoritesTableOrderingComposer,
      $$FavoritesTableAnnotationComposer,
      $$FavoritesTableCreateCompanionBuilder,
      $$FavoritesTableUpdateCompanionBuilder,
      (Favorite, BaseReferences<_$AppDatabase, $FavoritesTable, Favorite>),
      Favorite,
      PrefetchHooks Function()
    >;
typedef $$JobStatusTableCreateCompanionBuilder =
    JobStatusCompanion Function({
      required String jobId,
      required String status,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$JobStatusTableUpdateCompanionBuilder =
    JobStatusCompanion Function({
      Value<String> jobId,
      Value<String> status,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$JobStatusTableFilterComposer
    extends Composer<_$AppDatabase, $JobStatusTable> {
  $$JobStatusTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get jobId => $composableBuilder(
    column: $table.jobId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$JobStatusTableOrderingComposer
    extends Composer<_$AppDatabase, $JobStatusTable> {
  $$JobStatusTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get jobId => $composableBuilder(
    column: $table.jobId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$JobStatusTableAnnotationComposer
    extends Composer<_$AppDatabase, $JobStatusTable> {
  $$JobStatusTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get jobId =>
      $composableBuilder(column: $table.jobId, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$JobStatusTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $JobStatusTable,
          JobStatusData,
          $$JobStatusTableFilterComposer,
          $$JobStatusTableOrderingComposer,
          $$JobStatusTableAnnotationComposer,
          $$JobStatusTableCreateCompanionBuilder,
          $$JobStatusTableUpdateCompanionBuilder,
          (
            JobStatusData,
            BaseReferences<_$AppDatabase, $JobStatusTable, JobStatusData>,
          ),
          JobStatusData,
          PrefetchHooks Function()
        > {
  $$JobStatusTableTableManager(_$AppDatabase db, $JobStatusTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$JobStatusTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$JobStatusTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$JobStatusTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> jobId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => JobStatusCompanion(
                jobId: jobId,
                status: status,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String jobId,
                required String status,
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => JobStatusCompanion.insert(
                jobId: jobId,
                status: status,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$JobStatusTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $JobStatusTable,
      JobStatusData,
      $$JobStatusTableFilterComposer,
      $$JobStatusTableOrderingComposer,
      $$JobStatusTableAnnotationComposer,
      $$JobStatusTableCreateCompanionBuilder,
      $$JobStatusTableUpdateCompanionBuilder,
      (
        JobStatusData,
        BaseReferences<_$AppDatabase, $JobStatusTable, JobStatusData>,
      ),
      JobStatusData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$NotesTableTableManager get notes =>
      $$NotesTableTableManager(_db, _db.notes);
  $$LinksTableTableManager get links =>
      $$LinksTableTableManager(_db, _db.links);
  $$TagsTableTableManager get tags => $$TagsTableTableManager(_db, _db.tags);
  $$NoteTagsTableTableManager get noteTags =>
      $$NoteTagsTableTableManager(_db, _db.noteTags);
  $$LinkTagsTableTableManager get linkTags =>
      $$LinkTagsTableTableManager(_db, _db.linkTags);
  $$ShipsTableTableManager get ships =>
      $$ShipsTableTableManager(_db, _db.ships);
  $$ShipTagsTableTableManager get shipTags =>
      $$ShipTagsTableTableManager(_db, _db.shipTags);
  $$ScanHistoryTableTableManager get scanHistory =>
      $$ScanHistoryTableTableManager(_db, _db.scanHistory);
  $$TrackerHistoryTableTableManager get trackerHistory =>
      $$TrackerHistoryTableTableManager(_db, _db.trackerHistory);
  $$DiscoveryHistoryTableTableManager get discoveryHistory =>
      $$DiscoveryHistoryTableTableManager(_db, _db.discoveryHistory);
  $$FavoritesTableTableManager get favorites =>
      $$FavoritesTableTableManager(_db, _db.favorites);
  $$JobStatusTableTableManager get jobStatus =>
      $$JobStatusTableTableManager(_db, _db.jobStatus);
}
