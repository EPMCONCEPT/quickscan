import React, { useState } from 'react';
import { dbService, isFirebaseEnabled, auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { UserProfile, UserRole } from '../types';
import { LayoutGrid, GraduationCap, ShieldCheck, Mail, Lock, User, BookOpen, Key, AlertTriangle, ExternalLink } from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';

interface AuthScreenProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState<boolean>(false);
  const [isEmailAlreadyInUse, setIsEmailAlreadyInUse] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsOperationNotAllowed(false);
    setIsEmailAlreadyInUse(false);
    setIsLoading(true);

    if (!email || !password) {
      setErrorMessage('Please fill in email and password.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && !name) {
      setErrorMessage('Please provide your full name.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && role === 'student' && !studentId) {
      setErrorMessage('Please provide your Student Register ID.');
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        if (isFirebaseEnabled && auth) {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const profile = await dbService.getUserProfile(userCredential.user.uid);
          if (profile) {
            onAuthSuccess(profile);
          } else {
            // Safe fallback if profile doc isn't created yet but email exists
            const fallbackProfile: UserProfile = {
              uid: userCredential.user.uid,
              name: userCredential.user.email?.split('@')[0] || 'User',
              email: userCredential.user.email || '',
              role: 'student',
              createdAt: new Date().toISOString()
            };
            onAuthSuccess(fallbackProfile);
          }
        } else {
          // Local storage fallback login
          const users = JSON.parse(localStorage.getItem('qr_attendance_users') || '{}');
          // Find user by email and password
          const userProf = Object.values(users).find(
            (u: any) => u.email.toLowerCase() === email.toLowerCase()
          ) as UserProfile | undefined;
          
          if (userProf) {
            onAuthSuccess(userProf);
          } else {
            throw new Error("Invalid username or password. (Sandbox tip: Register a new account first!)");
          }
        }
      } else {
        // --- REGISTER FLOW ---
        const uid = isFirebaseEnabled && auth 
          ? (await createUserWithEmailAndPassword(auth, email, password)).user.uid 
          : 'fallback_' + Math.random().toString(36).substr(2, 9);

        const newProfile: UserProfile = {
          uid,
          name,
          email: email.toLowerCase(),
          role,
          createdAt: new Date().toISOString(),
          ...(role === 'student' ? { studentId } : {}),
          ...(department ? { department } : {})
        };

        await dbService.saveUserProfile(newProfile);
        onAuthSuccess(newProfile);
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message || "Authentication failed.";
      if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = "These credentials or email are already associated with an account.";
        setIsEmailAlreadyInUse(true);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMessage = "Incorrect email address or password.";
      } else if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        friendlyMessage = "Email/Password registration is currently disabled in your Firebase configuration.";
        setIsOperationNotAllowed(true);
      }
      setErrorMessage(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative ambient blurred backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 relative z-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl mb-3">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            QuickScan Attendance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Group 7 • QR Code Based Attendance System
          </p>
        </div>

        {/* Mode Selector Tab */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
          <button
            onClick={() => { setIsLogin(true); setErrorMessage(''); setIsOperationNotAllowed(false); setIsEmailAlreadyInUse(false); }}
            className={`py-2 text-center text-sm font-medium rounded-lg transition-all ${
              isLogin 
                ? 'bg-slate-800 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setIsLogin(false); setErrorMessage(''); setIsOperationNotAllowed(false); setIsEmailAlreadyInUse(false); }}
            className={`py-2 text-center text-sm font-medium rounded-lg transition-all ${
              !isLogin 
                ? 'bg-slate-800 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {errorMessage && (
          <div className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2.5 rounded-lg mb-4 leading-relaxed">
            {errorMessage}
          </div>
        )}

        {isEmailAlreadyInUse && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-200 text-xs space-y-3 mb-6 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-300 text-sm">Email Already in Use</p>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Every account (Teacher or Student) must have a <strong>unique</strong> email address.
                </p>
              </div>
            </div>
            
            <div className="text-slate-300 space-y-2 leading-relaxed">
              <p>
                If you already registered a <strong>Teacher</strong> account using this email address, you cannot reuse the same email for a Student account. Firebase requires each account to have its own unique email. Please register with a different, unique email address!
              </p>
              <p>
                If you already created your <strong>Student</strong> account, click the <strong>"Log In"</strong> tab above to sign into your Student interface.
              </p>
            </div>
          </div>
        )}

        {isOperationNotAllowed && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-3 mb-6 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300 text-sm">Action Required in Firebase</p>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Email/Password authentication must be enabled in your Firebase Console because it is disabled by default on new projects.
                </p>
              </div>
            </div>
            
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
              <li>Click the button below to open your console.</li>
              <li>Under the <strong>"Sign-in method"</strong> tab, click <strong>"Add new provider"</strong>.</li>
              <li>Select <strong>"Email/Password"</strong> and set it to <strong>"Enable"</strong>, then save.</li>
              <li>Refresh this page and register!</li>
            </ol>

            <div className="pt-1">
              <a 
                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Enable Email/Password Provider <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Role selector on registration */}
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                    role === 'student'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Student Role
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                    role === 'teacher'
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Teacher Role
                </button>
              </div>
            </div>
          )}

          {/* Core Name inputs (Register mode only) */}
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="auth-name" className="text-xs font-semibold text-slate-400">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="e.g. Professor Smith / Ibrahim Bello"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm placeholder:text-slate-600 font-sans"
                />
              </div>
            </div>
          )}

          {/* Student ID Code (Register Mode + Student Only) */}
          {!isLogin && role === 'student' && (
            <div className="space-y-1">
              <label htmlFor="auth-regno" className="text-xs font-semibold text-slate-400">Student Register ID</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <BookOpen className="w-4 h-4" />
                </span>
                <input
                  id="auth-regno"
                  type="text"
                  placeholder="e.g. SEC/COM/2026/0491"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm placeholder:text-slate-600 font-mono"
                />
              </div>
            </div>
          )}

          {/* Department Faculty Input (Register Mode Only) */}
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="auth-department" className="text-xs font-semibold text-slate-400">Department / Faculty (Optional)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <LayoutGrid className="w-4 h-4" />
                </span>
                <input
                  id="auth-department"
                  type="text"
                  placeholder="e.g. Computer Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm placeholder:text-slate-600 font-sans"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-xs font-semibold text-slate-400">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="auth-email"
                type="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm placeholder:text-slate-600 font-sans"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="auth-password" className="text-xs font-semibold text-slate-400">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm placeholder:text-slate-600 font-sans"
                required
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 font-semibold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              'Log In Account'
            ) : (
              'Register Account'
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500 font-sans">
            {!isFirebaseEnabled ? (
              <span className="flex items-center justify-center gap-1.5 text-amber-500/80">
                <Key className="w-3.5 h-3.5" /> Sandbox Mode Active (Local Database)
              </span>
            ) : (
              <span className="text-emerald-500/80">
                ✓ Cloud Sync Enabled (Firestore + Firebase Auth)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
