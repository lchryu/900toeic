# Google Login Setup

The app supports Google sign-in with Firebase Auth and saves practice progress in Firestore under:

```text
toeicProgress/{googleUserUid}
```

## 1. Create Firebase project

1. Open Firebase Console.
2. Create or select a project.
3. Add a Web app.
4. Enable Authentication -> Sign-in method -> Google.
5. Enable Firestore Database.

## 2. Add environment variables

Copy `.env.example` to `.env` and fill the Firebase web config:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Restart the dev server after changing `.env`.

## 3. Suggested Firestore rules

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /toeicProgress/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Without Firebase config, the app keeps working with local browser storage and shows the Google login panel as disabled.
