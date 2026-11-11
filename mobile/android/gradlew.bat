@ECHO OFF
REM Bootstrap: install JDK 17 + Android Studio, then regenerate the wrapper:
REM   gradle wrapper --gradle-version 8.9
REM Or open mobile/android in Android Studio (File > Open) and sync —
REM Studio will create gradle/wrapper/gradle-wrapper.jar automatically.
ECHO.
ECHO Aether Vision Android scaffold
ECHO -----------------------------
ECHO gradle-wrapper.jar is not vendored in this repo.
ECHO Open this folder in Android Studio to sync, or run:
ECHO   gradle wrapper --gradle-version 8.9
ECHO then:
ECHO   gradlew.bat :app:assembleDebug
ECHO.
EXIT /B 1
