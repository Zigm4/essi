# R8/ProGuard keep rules for Underdeck release builds.
#
# Release builds run R8 in full mode, which strips generic signatures and
# obfuscates classes that libraries reach via reflection. Without the rules
# below, flutter_local_notifications' GSON serialization (used on every
# zonedSchedule and by the boot receiver) throws at runtime, so Mars Express
# alerts silently fail to schedule in release and the app crashes on reboot.

# ---------------------------------------------------------------------------
# GSON (bundled by flutter_local_notifications)
# https://github.com/google/gson/blob/main/examples/android-proguard-example/proguard.cfg
# ---------------------------------------------------------------------------
# Keep generic type information for use by reflection (TypeToken).
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# GSON specific classes.
-dontwarn sun.misc.**
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken

# Prevent R8 from stripping type adapters and @SerializedName fields.
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# ---------------------------------------------------------------------------
# flutter_local_notifications
# Its GSON-serialized model classes live in this package and must keep their
# member names for reflection to round-trip.
# ---------------------------------------------------------------------------
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-dontwarn com.dexterous.flutterlocalnotifications.**

# ---------------------------------------------------------------------------
# Safety net for other reflective plugins used by the app.
# R8 is on for release regardless, so keep the native-backed libraries.
# ---------------------------------------------------------------------------
# sqlite3 / drift native bindings.
-keep class com.tekartik.** { *; }
-dontwarn com.tekartik.**

# Kotlin / coroutines metadata (used by several plugins).
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations
