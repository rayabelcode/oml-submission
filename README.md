# OML

This is a mobile application built with [Expo](https://expo.dev) and React Native. It helps you keep in touch with your contacts by scheduling calls and reminders while also providing AI-generated conversation suggestions and relationship overviews. The project uses Firebase for authentication, Firestore for real‑time data storage, Firebase Storage for images, and OpenAI’s ChatGPT API for personalized AI content.

## Overview

**OML Features:**

- **Contact Management:**
  – Import or add contacts manually
  – Tag contacts with relationship types (family, friend, work, personal)
  – View, edit, and archive contacts

- **Scheduling & Reminders:**
  – Schedule calls based on user preferences (active hours, preferred days)
  – Intelligent scheduling with conflict checking and fallback options
  – Snooze and reschedule options (“Later Today”, “Tomorrow”, “Next Week”, “Skip”)

- **AI Overview:**
  – Generative conversation topics and relationship overviews from your call history using OpenAI API
  – Results are cached for improved performance

- **Notifications:**
  – Local notifications combined with push notifications through Expo
  – A notification coordinator manages scheduling, retries with backoff, and cleans up old/invalid tokens

- **Offline Caching:**
  – Uses AsyncStorage to cache contacts, profiles, reminders, and scheduling history
  – Enables offline use with a pending operation queue for sync

- **Theming & Settings:**
  – Multiple themes including Light, Dark, Dimmed, and System
  – Customizable scheduling and privacy preferences

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) installed
- [Expo CLI](https://docs.expo.dev/get-started/installation/) installed globally (optional)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/rayabelcode/oml-submission.git
   cd oml-submission
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory and add Firebase, OpenAI, and other configuration details:

   ```dotenv
   EXPO_PUBLIC_FIREBASE_API_KEY=firebase_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=firebase_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=app_id
   OPENAI_API_KEY=openai_api_key
   ```

4. **Start the app**

   ```bash
   npx expo start
   ```

   In the terminal output you’ll find links/options to open the app in:

   - A [development build](https://docs.expo.dev/develop/development-builds/introduction/)
   - An [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
   - An [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
   - [Expo Go](https://expo.dev/go) for quick testing

## Project Structure

- **App.js:**  
  Bootstraps the app with Context Providers (AuthContext, ThemeContext, PreloadContext) and initializes global settings like Analytics and Notifications

- **src/components/:**  
  Contains reusable UI components:

  - Contact cards, modals, and tab components (e.g. AIModal for AI suggestions)
  - General components like ActionModal, ImagePicker, and KeyboardDismiss

- **src/context/:**  
  Global state providers including AuthContext (for authentication), ThemeContext (for theming), and PreloadContext (for data preloading).

- **src/navigation/:**  
  Navigation stacks (Root, Tab, and Settings/Contacts stacks) for user flow

- **src/screens/:**  
  Contains all major screens:

  - ContactsScreen, DashboardScreen, SettingsScreen, and ScheduleScreen

- **src/utils/:**  
  Utility functions and modules:

  - **firestore.js:** Interacts with Firestore and Firebase Storage
  - **cacheManager.js:** Caching with AsyncStorage
  - **scheduler/:** Custom scheduling logic (SchedulingService, SnoozeHandler, schedulingHistory)
  - **notifications/:** Modules for push notifications, notification coordination, and reminder sync
  - **ai.js:** Uses OpenAI API to generate topics and overviews
  - - additional modules for call handling, image picking, and more

- **src/constants/:**  
  Contains constant values (colors, notification constants, relationship types, scheduler settings)

## Technologies Used

- React Native & Expo with JavaScript
- Firebase (Firestore, Authentication, Storage)
- OpenAI ChatGPT API for generating AI content
- AsyncStorage for offline caching
- Expo Notifications & Push Token Management
- Luxon for advanced date/time handling
- Sentry for error tracking

## License

This repository is public for visibility purposes only and is not open source.
All rights reserved. No usage, modification, or distribution is permitted.

---

Reference Links:

- [Expo Documentation](https://docs.expo.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Sentry for React Native](https://docs.sentry.io/platforms/react-native/)
