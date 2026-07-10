import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// Content-integrity primitives for the maps pipeline.
///
/// This is the sha256 transport-integrity layer (pointer -> manifest -> files).
/// It proves the bytes on disk match the bytes the manifest pinned.
///
/// ED25519 SEAM (intentionally out of scope for M0 — AUDIT-V2 §4.2):
/// a signature check over the *pointer* is what actually defends against a
/// repo/account compromise (sha256 alone is theatre there — whoever rewrites
/// the pointer rewrites its hashes). When added, it belongs as a sibling
/// `verifyPointerSignature(bytes, sig, publicKeys)` guard that runs BEFORE any
/// of the sha256 checks below, with the private key living off-GitHub and two
/// embedded public keys for rotation. Do NOT implement the signing ceremony now.

/// Lowercase hex sha256 of [bytes].
String sha256Hex(Uint8List bytes) => sha256.convert(bytes).toString();

/// Returns `true` iff sha256([bytes]) equals [expectedHex] (case-insensitive).
///
/// The comparison is length-checked and constant-time over the digest so it
/// never short-circuits on the first differing nibble.
bool verifyBytes(Uint8List bytes, String expectedHex) {
  final actual = sha256Hex(bytes);
  final expected = expectedHex.trim().toLowerCase();
  if (actual.length != expected.length) return false;
  var diff = 0;
  for (var i = 0; i < actual.length; i++) {
    diff |= actual.codeUnitAt(i) ^ expected.codeUnitAt(i);
  }
  return diff == 0;
}
