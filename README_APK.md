# QR Code Student Attendance - Android APK Build Guide

This guide explains how to build the APK for the **QR Code Student Attendance** application using Capacitor and Android Studio.

## Prerequisites
1. **Node.js**: Installed on your machine.
2. **Android Studio**: Installed with the Android SDK (API 34/35 recommended).
3. **Command Line Tools**: PowerShell, Command Prompt, or Terminal.

---

## Step-By-Step Local Commands

### Step 1: Install Local Dependencies
If you just cloned or extracted the project, open your terminal inside the project directory and run:
```bash
npm install
```

### Step 2: Build and Sync with Capacitor
Run the sync script. This builds the static React files inside `dist/` and copies them into the Android package assets:
```bash
npm run apk:sync
```
*(This is a shortcut script we created which runs `npm run build && npx @capacitor/cli sync android`)*

### Step 3: Add the Android platform (If not already added)
If this is your first time initializing the Android project folder locally, run:
```bash
npm run apk:add
```
*(This is a shortcut script we created which runs `npx @capacitor/cli add android`)*

---

## Step 4: Build the APK in Android Studio

1. **Open Android Studio**.
2. Click on **Open File or Project** and navigate to your project folder.
3. Select the `/android` directory inside your project folder and click **OK**.
4. Wait for Android Studio to index the project and sync Gradle files (this may take a couple of minutes on first open).
5. In the top menu bar, click:
   **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
6. Once the build completes, a popup bubble will appear on the bottom right. Click **locate** to open the folder containing your release-ready, installable APK file (`app-debug.apk` or `app-release-unsigned.apk`).
7. Transfer this APK file to your phone (via USB, email, Google Drive, or messaging apps) and install it on any Android device!
