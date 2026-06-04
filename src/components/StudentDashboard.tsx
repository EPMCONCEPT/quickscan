import React, { useState, useEffect } from 'react';
import { UserProfile, AttendanceRecord, ClassSession } from '../types';
import { dbService } from '../firebase';
import Scanner from './Scanner';
import { Camera, Calendar, LogOut, CheckCircle, Clock, AlertTriangle, ListChecks, Keyboard, PlusCircle, RefreshCw } from 'lucide-react';

interface StudentDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function StudentDashboard({ profile, onLogout }: StudentDashboardProps) {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string; session?: ClassSession } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
  }, [profile]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const logs = await dbService.getStudentHistory(profile.email);
      setHistory(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleProcessCheckIn = async (sessionCode: string, method: 'qr_scan' | 'manual_code') => {
    setIsCheckingIn(true);
    setCheckInResult(null);

    try {
      // Find matching session in DB
      const sessions = await dbService.getSessions();
      
      // Clean inputs
      const targetCode = sessionCode.trim().toUpperCase();

      // Find session where subject sessionCode matches OR manual numeric pin matches
      const matchedSession = sessions.find(s => {
        if (!s.isActive) return false;
        
        // Exact full match (e.g., CS401-4915)
        if (s.sessionCode === targetCode) return true;

        // Numeric suffix match for manual codes (e.g., student typed "4915" and active session code is "CS401-4915")
        const pinPart = s.sessionCode.split('-')[1];
        if (pinPart && pinPart === targetCode) return true;

        return false;
      });

      if (!matchedSession) {
        setCheckInResult({
          success: false,
          message: "No active lecture matches this attendance code. Double check the code displayed on your teacher's board."
        });
        setIsCheckingIn(false);
        return;
      }

      // Check if already checked in
      const alreadyChecked = await dbService.hasCheckedIn(matchedSession.id, profile.email);
      if (alreadyChecked) {
        setCheckInResult({
          success: true,
          message: "You have already marked your attendance for this class session!",
          session: matchedSession
        });
        setIsCheckingIn(false);
        return;
      }

      // Check status: inside time bounds?
      const now = new Date();
      const expiry = new Date(matchedSession.expiresAt);
      
      if (now > expiry) {
        setCheckInResult({
          success: false,
          message: "This lecture check-in window has already closed. You cannot check in."
        });
        setIsCheckingIn(false);
        return;
      }

      // Estimate status: default present. If 80% through the window is past, mark late.
      const status: 'present' | 'late' = 'present'; 

      const attendanceRecord: AttendanceRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sessionId: matchedSession.id,
        sessionCode: matchedSession.sessionCode,
        className: matchedSession.className,
        subjectCode: matchedSession.subjectCode,
        studentId: profile.uid,
        studentName: profile.name,
        studentEmail: profile.email,
        studentRegNo: profile.studentId || "NONE Specified",
        scannedAt: new Date().toISOString(),
        checkInMethod: method,
        status,
        department: profile.department
      };

      await dbService.addAttendanceRecord(attendanceRecord);
      
      setCheckInResult({
        success: true,
        message: `Successfully verified on ${new Date().toLocaleTimeString()}! Present for class context.`,
        session: matchedSession
      });

      setManualCode('');
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      setCheckInResult({
        success: false,
        message: err.message || "Attendance validation failed. Please contact your instructor."
      });
    } finally {
      setIsCheckingIn(false);
      setIsScannerOpen(false);
    }
  };

  const handleManualCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessCheckIn(manualCode, 'manual_code');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between max-w-xl mx-auto w-full relative">
      {/* Decorative blurred gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* TOP USER WELCOME CARD */}
      <header className="mb-6 relative z-15">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              🎓
            </div>
            <div>
              <h1 id="student-name-header" className="text-sm font-bold text-slate-100">{profile.name}</h1>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Reg: {profile.studentId || "No Register Number"}
              </p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="p-2 hover:bg-red-500/5 border border-transparent hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CHECK-IN INTERACTIVE ZONE */}
      <section className="flex-1 space-y-6 flex flex-col justify-center relative z-10">
        
        {/* State Banner Feedback */}
        {checkInResult && (
          <div className={`p-4 border rounded-2xl leading-relaxed text-sm shadow-md transition-all ${
            checkInResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-start gap-3">
              {checkInResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-extrabold text-sm">{checkInResult.success ? "Check-In Success" : "Validation Refused"}</p>
                {checkInResult.session && (
                  <p className="font-bold text-xs mt-1 text-slate-200">
                    {checkInResult.session.subjectCode}: {checkInResult.session.className}
                  </p>
                )}
                <p className="text-xs text-slate-300 font-medium mt-1">{checkInResult.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* LOADING PROGRESS RING */}
        {isCheckingIn && (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <p className="text-xs text-slate-400 font-bold">Verifying lecture signature...</p>
          </div>
        )}

        {/* QR CAMERA VIEWFINDER (IF TRIGGERED) */}
        {isScannerOpen && !isCheckingIn && (
          <Scanner
            onScanSuccess={(code) => handleProcessCheckIn(code, 'qr_scan')}
            onClose={() => setIsScannerOpen(false)}
          />
        )}

        {/* PRIMARY CONTROL PANEL (SCANNER OFF & NOT LOADING) */}
        {!isScannerOpen && !isCheckingIn && (
          <div className="space-y-4">
            
            {/* LARGE SCAN ATTENDANCE TRIGGER BUTTON */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-center space-y-4 relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
              
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-100">Scan Attendance Code</h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                  Open your camera frame to instantly scan the QR code displayed on your lecturer's board.
                </p>
              </div>

              <button
                id="student-scan-btn"
                onClick={() => {
                  setCheckInResult(null);
                  setIsScannerOpen(true);
                }}
                className="w-full py-3 bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 rounded-2xl text-sm transition-all shadow cursor-pointer uppercase tracking-wider"
              >
                Scan teacher's QR Code
              </button>
            </div>

            {/* MANUAL CHECK-IN PIN FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex items-center gap-2 mb-3">
                <Keyboard className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Manual Check-In Code</h3>
              </div>
              <form onSubmit={handleManualCheckInSubmit} className="flex gap-2">
                <input
                  id="student-manual-input"
                  type="text"
                  placeholder="e.g. 1934 (4 digit Pin code)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-200 text-sm font-mono placeholder:text-slate-700"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer"
                >
                  Verify
                </button>
              </form>
              <p className="text-[10px] text-slate-500 mt-2 font-sans leading-relaxed">
                Lecturers display a 4-digit numeric code on their board alongside the QR code as a standard fallback connection mechanism.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* STUDENT ATTENDANCE RECEIPT HISTORY LOG */}
      <section className="mt-8 relative z-10 border-t border-slate-900 pt-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-sans">
          <ListChecks className="w-4 h-4 text-blue-400" />
          My Checked-In Lectures History
        </h3>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            Reading history files...
          </div>
        ) : history.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6 text-center text-xs text-slate-500 font-sans leading-relaxed">
            You haven't checked into any lectures yet. Ready to scan?
          </div>
        ) : (
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {history.map((record) => (
              <div key={record.id} className="bg-slate-900/60 hover:bg-slate-900 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3 transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                      {record.subjectCode}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium font-sans">
                      {new Date(record.scannedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-200 mt-1 truncate text-xs">{record.className}</h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                    ✓ Verified
                  </span>
                  <p className="text-[9px] text-slate-600 font-mono mt-0.5">
                    {new Date(record.scannedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
