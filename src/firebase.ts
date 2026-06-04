import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, doc as firestoreDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { UserProfile, ClassSession, AttendanceRecord } from './types';

// Check if Firebase was provisioned with actual details
export const isFirebaseEnabled = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "");

let app;
export let db: any = null;
export let auth: any = null;

if (isFirebaseEnabled) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// Ensure first-run connection test if online
if (isFirebaseEnabled && db) {
  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration: Client is offline.");
      }
    }
  };
  testConnection();
}

// ---------------------------------------------------------
// ERROR HANDLER ENGINE & CLOUD STORAGE CONTRACTS
// ---------------------------------------------------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ---------------------------------------------------------
// LOCAL STORAGE AUTONOMOUS FALLBACK ENGINE
// ---------------------------------------------------------
// To support full functionality if Firebase contains empty placeholders.

const LOCAL_USERS_KEY = 'qr_attendance_users';
const LOCAL_SESSIONS_KEY = 'qr_attendance_sessions';
const LOCAL_RECORDS_KEY = 'qr_attendance_records';
const LOCAL_CURRENT_USER_KEY = 'qr_attendance_current_user';

// Listeners tracking for local updates to support real-time UI without Firestore
type LocalListenerCallback = (data: any[]) => void;
const activeLocalListeners: { [sessionId: string]: LocalListenerCallback[] } = {};

const triggerLocalListeners = (sessionId: string, records: AttendanceRecord[]) => {
  if (activeLocalListeners[sessionId]) {
    activeLocalListeners[sessionId].forEach(callback => callback(records));
  }
};

export const dbService = {
  // SAVE USER PROFILE
  async saveUserProfile(profile: UserProfile): Promise<void> {
    if (isFirebaseEnabled && db) {
      const userRef = doc(db, 'users', profile.uid);
      try {
        await setDoc(userRef, profile);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
      }
    } else {
      const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
      users[profile.uid] = profile;
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    }
  },

  // FETCH USER PROFILE
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (isFirebaseEnabled && db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          return userDoc.data() as UserProfile;
        }
        return null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
        return null;
      }
    } else {
      const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
      return users[uid] || null;
    }
  },

  // CREATE CLASS SESSION
  async createClassSession(session: ClassSession): Promise<void> {
    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'sessions', session.id), session);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `sessions/${session.id}`);
      }
    } else {
      const sessions = JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]');
      sessions.push(session);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    }
  },

  // GET ACTIVE SESSIONS
  async getSessions(): Promise<ClassSession[]> {
    if (isFirebaseEnabled && db) {
      try {
        const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const list: ClassSession[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as ClassSession);
        });
        return list;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
        return [];
      }
    } else {
      const sessions: ClassSession[] = JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]');
      // Sort desc
      return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  // END CLASS SESSION
  async endClassSession(sessionId: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, 'sessions', sessionId);
      try {
        await setDoc(docRef, { isActive: false }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
      }
    } else {
      const sessions: ClassSession[] = JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]');
      const updated = sessions.map(s => s.id === sessionId ? { ...s, isActive: false } : s);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(updated));
    }
  },

  // SUBMIT ATTENDANCE LOG
  async addAttendanceRecord(record: AttendanceRecord): Promise<void> {
    if (isFirebaseEnabled && db) {
      // Create unique record ID to prevent double check-ins
      const recordId = `${record.sessionId}_${record.studentEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        await setDoc(doc(db, 'attendance', recordId), record);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `attendance/${recordId}`);
      }
    } else {
      const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
      
      // Prevent duplicates
      const exists = records.some(r => r.sessionId === record.sessionId && r.studentEmail === record.studentEmail);
      if (!exists) {
        records.push(record);
        localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
        
        // Notify any active local real-time listener
        const sessionRecords = records.filter(r => r.sessionId === record.sessionId);
        triggerLocalListeners(record.sessionId, sessionRecords);
      }
    }
  },

  // CHECK IF STUDENT ALREADY MARKED
  async hasCheckedIn(sessionId: string, studentEmail: string): Promise<boolean> {
    if (isFirebaseEnabled && db) {
      const recordId = `${sessionId}_${studentEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        const recordDoc = await getDoc(doc(db, 'attendance', recordId));
        return recordDoc.exists();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `attendance/${recordId}`);
        return false;
      }
    } else {
      const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
      return records.some(r => r.sessionId === sessionId && r.studentEmail === studentEmail);
    }
  },

  // REAL-TIME LISTENER FOR CLASS ATTENDANCE
  listenToSessionRecords(sessionId: string, callback: (records: AttendanceRecord[]) => void): () => void {
    if (isFirebaseEnabled && db) {
      const q = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: AttendanceRecord[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as AttendanceRecord);
        });
        // Sort by check-in time desc
        list.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
        callback(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      });
      return unsubscribe;
    } else {
      // Local real-time listener simulation
      if (!activeLocalListeners[sessionId]) {
        activeLocalListeners[sessionId] = [];
      }
      activeLocalListeners[sessionId].push(callback);

      // Initial push
      const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
      const sessionRecords = records.filter(r => r.sessionId === sessionId)
        .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      
      callback(sessionRecords);

      // Unsubscribe callback
      return () => {
        activeLocalListeners[sessionId] = activeLocalListeners[sessionId].filter(cb => cb !== callback);
      };
    }
  },

  // GET ATTENDANCE HISTORY FOR A STUDENT
  async getStudentHistory(studentEmail: string): Promise<AttendanceRecord[]> {
    if (isFirebaseEnabled && db) {
      try {
        const q = query(
          collection(db, 'attendance'),
          where('studentEmail', '==', studentEmail)
        );
        const snapshot = await getDocs(q);
        const list: AttendanceRecord[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as AttendanceRecord);
        });
        // Sort desc
        return list.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
        return [];
      }
    } else {
      const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
      return records.filter(r => r.studentEmail === studentEmail)
        .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
    }
  },

  // GET ALL LOGS FOR TEACHER SUMMARY
  async getTeacherSessionsWithStats(teacherId: string): Promise<{ session: ClassSession; count: number }[]> {
    try {
      const sessions = await this.getSessions();
      const teacherSessions = sessions.filter(s => s.teacherId === teacherId);

      if (isFirebaseEnabled && db) {
        const list: { session: ClassSession; count: number }[] = [];
        for (const sess of teacherSessions) {
          try {
            const q = query(collection(db, 'attendance'), where('sessionId', '==', sess.id));
            const countSnap = await getDocs(q);
            list.push({ session: sess, count: countSnap.size });
          } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'attendance');
          }
        }
        return list;
      } else {
        const allRecords: AttendanceRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
        return teacherSessions.map(sess => {
          const count = allRecords.filter(r => r.sessionId === sess.id).length;
          return { session: sess, count };
        });
      }
    } catch (error) {
      if (isFirebaseEnabled && db) {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      }
      return [];
    }
  }
};
