/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { isFirebaseEnabled, auth, dbService } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';

const LOCAL_CURRENT_USER_KEY = 'qr_attendance_current_user';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Initialize and restore active testing session states
  useEffect(() => {
    // 1. Subscribe to Firebase Auth if active
    if (isFirebaseEnabled && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const profile = await dbService.getUserProfile(firebaseUser.uid);
            if (profile) {
              setUserProfile(profile);
            } else {
              // Default fallback profile if collection document is pending
              setUserProfile({
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firebaseUser.email || '',
                role: 'student',
                createdAt: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error("Failed to query authenticated profile:", err);
          }
        } else {
          setUserProfile(null);
        }
        setIsInitializing(false);
      });
      return () => unsubscribe();
    } else {
      // 2. Local Storage session restoration (Frictionless testing)
      const stored = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
      if (stored) {
        try {
          setUserProfile(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to restore cached user session:", e);
        }
      }
      setIsInitializing(false);
    }
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    // Cache profile locally in sandbox mode to keep test users logged in during page refreshes
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(profile));
  };

  const handleLogout = async () => {
    if (isFirebaseEnabled && auth) {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Sign-out errors:", err);
      }
    }
    setUserProfile(null);
    localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs mt-4 font-semibold font-sans">Booting QuickScan attendance channels...</p>
      </div>
    );
  }

  if (!userProfile) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {userProfile.role === 'teacher' ? (
        <TeacherDashboard profile={userProfile} onLogout={handleLogout} />
      ) : (
        <StudentDashboard profile={userProfile} onLogout={handleLogout} />
      )}
    </div>
  );
}

