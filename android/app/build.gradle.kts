import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release upload-key credentials. The properties file is gitignored; if it's
// missing (e.g. fresh checkout, CI without secrets) we fall back to debug
// signing so debug builds still work — but we refuse to build an actual
// release with the debug key (see the guard below).
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

// Fail loudly if someone tries to assemble a release without real signing,
// instead of silently shipping a debug-signed artifact (rejected by Play,
// and not upgradable by a real release later). Debug/profile builds and IDE
// sync are unaffected because they schedule no "*Release" task.
val buildingRelease = gradle.startParameter.taskNames.any { it.contains("Release") }
if (buildingRelease && !keystorePropsFile.exists()) {
    throw GradleException(
        "keystore.properties is missing: refusing to build a release signed " +
            "with the debug key. Create android/keystore.properties with " +
            "storeFile, storePassword, keyAlias and keyPassword. " +
            "See https://flutter.dev/to/reference-keystore",
    )
}

android {
    namespace = "xyz.overthecloud.underdeck"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "xyz.overthecloud.underdeck"
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        // versionName is overridden so the user-visible label matches iPhone
        // ("0.2.0 alpha 3"). iOS' CFBundleShortVersionString can only be a
        // dotted triplet (Apple constraint), so on iOS the suffix lives in
        // the TestFlight test notes; Android has no such restriction.
        versionName = "${flutter.versionName} alpha 4"
        multiDexEnabled = true
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")

            // R8 runs for release builds; make sure our keep rules are applied
            // so flutter_local_notifications' GSON (TypeToken) reflection
            // survives — otherwise scheduled alerts crash in release only.
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
