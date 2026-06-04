import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClassSession, AttendanceRecord, UserProfile } from '../types';
import { dbService } from '../firebase';
import { PlusCircle, Clock, Users, ArrowRight, CheckCircle, FileSpreadsheet, LogOut, ChevronRight, BarChart3, Search, Play, StopCircle, RefreshCw, Calendar, Trash2 } from 'lucide-react';

interface TeacherDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
}

export default function TeacherDashboard({ profile, onLogout }: TeacherDashboardProps) {
  // Navigation / views state
  const [activeTab, setActiveTab] = useState<'create' | 'active' | 'history'>('create');
  
  // Create Form states
  const [className, setClassName] = useState<string>('');
  const [subjectCode, setSubjectCode] = useState<string>('');
  const [duration, setDuration] = useState<number>(10); // Standard 10 minutes session

  // Session & records tracking state
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [liveRecords, setLiveRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // History stats
  const [sessionHistory, setSessionHistory] = useState<{ session: ClassSession; count: number }[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<ClassSession | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Load session state and history on login
  useEffect(() => {
    checkActiveSession();
    fetchHistory();
  }, []);

  // Timer loop for active session
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      const expiry = new Date(activeSession.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        handleEndSession();
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Real-time listener for active class session
  useEffect(() => {
    if (!activeSession) {
      setLiveRecords([]);
      return;
    }

    const unsubscribe = dbService.listenToSessionRecords(activeSession.id, (records) => {
      setLiveRecords(records);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeSession]);

  const checkActiveSession = async () => {
    const list = await dbService.getSessions();
    const active = list.find(s => s.teacherId === profile.uid && s.isActive && new Date(s.expiresAt).getTime() > new Date().getTime());
    if (active) {
      setActiveSession(active);
      setActiveTab('active');
    }
  };

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const data = await dbService.getTeacherSessionsWithStats(profile.uid);
      setSessionHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !subjectCode) return;

    const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomDigitCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code e.g. 5831

    const sessionObj: ClassSession = {
      id: `sess_${Date.now()}_${shortId}`,
      teacherId: profile.uid,
      className,
      subjectCode: subjectCode.trim().toUpperCase(),
      sessionCode: `${subjectCode.trim().toUpperCase()}-${randomDigitCode}`, // e.g. CS401-4915
      isActive: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      durationMinutes: duration
    };

    await dbService.createClassSession(sessionObj);
    setActiveSession(sessionObj);
    setActiveTab('active');
    // Clear form inputs
    setClassName('');
    setSubjectCode('');
    fetchHistory();
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    await dbService.endClassSession(activeSession.id);
    setActiveSession(null);
    setActiveTab('create');
    fetchHistory();
  };

  const loadHistoryRecords = async (session: ClassSession) => {
    setSelectedHistorySession(session);
    setHistoryRecords([]);
    // Load records for this historic class
    dbService.listenToSessionRecords(session.id, (records) => {
      setHistoryRecords(records);
    });
  };

  const handleExportCSV = (records: AttendanceRecord[], session: ClassSession) => {
    const headers = "Student Name,Register ID,Email,Department,Check-In Time,Method,Status\n";
    const rows = records.map(r => 
      `"${r.studentName}","${r.studentRegNo}","${r.studentEmail}","${r.department || ''}","${new Date(r.scannedAt).toLocaleTimeString()}","${r.checkInMethod === 'qr_scan' ? 'QR Code Scanned' : 'Manual Code Entered'}","${r.status.toUpperCase()}"`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_${session.subjectCode}_${session.className.replace(/\s+/g, '_')}_${new Date(session.createdAt).toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rosters based on search queries
  const filteredLiveRecords = liveRecords.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentRegNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistoryRecords = historyRecords.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentRegNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row pb-12">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
        <div>
          {/* Faculty Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
              T
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{profile.name}</p>
              <p className="text-xs text-slate-500 font-sans">{profile.department || "Lecturer / Admin"}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold'
                  : 'text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              New Attendance Session
            </button>

            <button
              onClick={() => {
                if (activeSession) {
                  setActiveTab('active');
                } else {
                  alert("No active session! Start a session first.");
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <span className="flex items-center gap-3">
                <Clock className="w-4 h-4" />
                Active Monitor
              </span>
              {activeSession && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                fetchHistory();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold'
                  : 'text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              History & Logs
            </button>
          </nav>
        </div>

        {/* Logout widget */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl text-sm font-medium transition border border-transparent cursor-pointer mt-8"
        >
          <LogOut className="w-4 h-4" />
          Logout Faculty
        </button>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full">
        {/* TAB 1: CREATE NEW Attendance SESSION */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold font-sans">Start Attendance Session</h2>
              <p className="text-slate-400 text-xs mt-1">
                Establish a lecture window. A unique QR scanner key will be generated dynamically.
              </p>
            </div>

            {activeSession ? (
              <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-emerald-400 flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Lecture Already Active
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 font-semibold">
                    {activeSession.subjectCode}: {activeSession.className}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Code: {activeSession.sessionCode}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('active')}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-emerald-400 transition"
                >
                  View Live Screen
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleStartSession} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="teacher-subject-code" className="text-xs font-semibold text-slate-400">Course Subject Code *</label>
                    <input
                      id="teacher-subject-code"
                      type="text"
                      placeholder="e.g. CS-402"
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-200 text-sm placeholder:text-slate-600 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="teacher-class-name" className="text-xs font-semibold text-slate-400">Class Lecture Title *</label>
                    <input
                      id="teacher-class-name"
                      type="text"
                      placeholder="e.g. Artificial Intelligence"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-200 text-sm placeholder:text-slate-600 font-sans"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Session Active Window Duration</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 20, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDuration(mins)}
                        className={`py-2 text-center text-xs font-bold rounded-xl transition ${
                          duration === mins
                            ? 'bg-blue-500 text-slate-950 shadow-md'
                            : 'bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {mins} Min
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  id="teacher-start-btn"
                  type="submit"
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  Spin Up attendance QR Code
                </button>
              </form>
            )}

            {/* General tips */}
            <div className="bg-slate-900/50 border border-slate-900 rounded-2xl p-5 text-xs text-slate-400 leading-relaxed font-sans mt-8 space-y-2">
              <p className="font-semibold text-slate-300">How to test locally with students:</p>
              <p>1. Copy your Dev App link from top-right. Share this link to testing phones via QR or messenger.</p>
              <p>2. Set up a class above and display this browser screen on your desktop or TV panel.</p>
              <p>3. Students load the link on their phone, register, hit "Scan QR" and point it at this screen.</p>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE REALT-IME MONITOR */}
        {activeTab === 'active' && activeSession && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="inline-block py-1 px-2.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full select-none mb-1">
                  🔴 LIVE SCANNER READY
                </span>
                <h2 className="text-xl font-bold">{activeSession.subjectCode}: {activeSession.className}</h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Duration: {activeSession.durationMinutes} Min • Auto-refresh active
                </p>
              </div>
              <button
                id="teacher-end-btn"
                onClick={handleEndSession}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 text-red-400 hover:text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition"
              >
                <StopCircle className="w-4 h-4" />
                Kill Class Session
              </button>
            </div>

            {/* QR Code and Meta Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* QR Container */}
              <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow">
                <div className="p-3 bg-white rounded-xl shadow-lg border-4 border-slate-100 flex items-center justify-center">
                  <QRCodeSVG
                    value={activeSession.sessionCode}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Student Scan QR Code</p>
                  <p className="text-emerald-400 font-extrabold text-sm mt-1 select-all font-mono">
                    CODE: {activeSession.sessionCode.split('-')[1]}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mt-1">
                    Students can input this 4-digit code manually on their screens if camera feed is blocked
                  </p>
                </div>
              </div>

              {/* Attendance quick metrics */}
              <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">LECTURE STATUS</p>
                    <span className="text-xs font-bold font-mono text-emerald-400 pb-0.5 bg-emerald-500/10 px-2 rounded-md">
                      ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">COUNT</p>
                      <p id="teacher-live-count" className="text-2xl font-black text-blue-400 mt-1">{liveRecords.length}</p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">ON TIME</p>
                      <p className="text-2xl font-black text-emerald-400 mt-1">
                        {liveRecords.filter(r => r.status === 'present').length}
                      </p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">LATE</p>
                      <p className="text-2xl font-black text-pink-400 mt-1">
                        {liveRecords.filter(r => r.status === 'late').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">TIme remaining</p>
                      <p className="text-sm font-extrabold text-slate-200 mt-0.5 font-mono">{timeRemaining}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleExportCSV(liveRecords, activeSession)}
                    disabled={liveRecords.length === 0}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export CSV Spreadsheet
                  </button>
                </div>
              </div>
            </div>

            {/* LIVE ROSTER TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Live Checked-In Roster
                </h3>

                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-600">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by ID or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-200 text-xs placeholder:text-slate-600 font-sans"
                  />
                </div>
              </div>

              {filteredLiveRecords.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 max-w-xs mx-auto">
                  {searchQuery ? 'No search results found.' : 'No students checked into this session yet. The live feed will refresh automatically once students check-in.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 font-medium">
                        <th className="py-2.5">STUDENT NAME</th>
                        <th className="py-2.5">REGISTER ID</th>
                        <th className="py-2.5">TIME RECEIVED</th>
                        <th className="py-2.5">METHOD</th>
                        <th className="py-2.5 text-right">MARK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredLiveRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-850/20 text-slate-300">
                          <td className="py-2.5">
                            <span className="font-bold text-slate-100 block">{record.studentName}</span>
                            <span className="text-[10px] text-slate-500 block">{record.studentEmail}</span>
                          </td>
                          <td className="py-2.5 font-mono">{record.studentRegNo}</td>
                          <td className="py-2.5 font-mono">
                            {new Date(record.scannedAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                              record.checkInMethod === 'qr_scan'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {record.checkInMethod === 'qr_scan' ? 'QR Scan' : 'Manual Code'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-medium">
                            <span className={`inline-block py-0.5 px-2 rounded-md ${
                              record.status === 'present'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                            }`}>
                              {record.status === 'present' ? 'Present' : 'Late'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold font-sans">Attendance Logs History</h2>
              <p className="text-slate-400 text-xs mt-1">
                Inspect past lecture attendances and export spreadsheet rosters.
              </p>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                Loading ledger records...
              </div>
            ) : selectedHistorySession ? (
              // DETAILS OF A SELECT HISTORY SESSION
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedHistorySession(null)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline"
                >
                  &larr; Back to Session Ledger Lists
                </button>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400 font-mono">
                      {selectedHistorySession.subjectCode}
                    </span>
                    <h3 className="font-bold text-base mt-2">{selectedHistorySession.className}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-sans">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(selectedHistorySession.createdAt).toLocaleDateString()} at{' '}
                      {new Date(selectedHistorySession.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleExportCSV(historyRecords, selectedHistorySession)}
                    className="w-full md:w-auto px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download CSV
                  </button>
                </div>

                {/* HISTORIC ATTENDANCE roster */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <p className="text-xs font-bold text-slate-400">ATTENDANCE ROSTER ({historyRecords.length} presents)</p>
                    <input
                      type="text"
                      placeholder="Filter student..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 text-slate-200 text-xs placeholder:text-slate-600 font-sans w-48"
                    />
                  </div>

                  {filteredHistoryRecords.length === 0 ? (
                    <p className="text-center py-6 text-slate-500 text-xs">No records recorded in this session.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-850 font-semibold text-slate-400">
                            <th className="py-2">STUDENT NAME</th>
                            <th className="py-2">REGISTER ID</th>
                            <th className="py-2">CHECK IN</th>
                            <th className="py-2 text-right">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {filteredHistoryRecords.map(rec => (
                            <tr key={rec.id} className="hover:bg-slate-850/20">
                              <td className="py-2 font-bold text-slate-100">{rec.studentName}</td>
                              <td className="py-2 font-mono">{rec.studentRegNo}</td>
                              <td className="py-2 font-mono">{new Date(rec.scannedAt).toLocaleTimeString()}</td>
                              <td className="py-2 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  rec.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-pink-500/10 text-pink-400'
                                }`}>
                                  {rec.status === 'present' ? 'Present' : 'Late'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // GENERAL SESSIONS HISTORY LIST
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                {sessionHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-sans">
                    You have not hosted any attendance sessions yet. Go back to 'New Attendance Session' to start.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-850">
                    {sessionHistory.map(({ session, count }) => (
                      <div
                        key={session.id}
                        onClick={() => loadHistoryRecords(session)}
                        className="p-4 hover:bg-slate-850/50 flex items-center justify-between cursor-pointer transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                              {session.subjectCode}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-sm text-slate-200 mt-1.5">{session.className}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                            {session.durationMinutes} Min window • code: {session.sessionCode}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-200">{count} Present</p>
                            <p className="text-[10px] text-slate-500">attendance count</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
