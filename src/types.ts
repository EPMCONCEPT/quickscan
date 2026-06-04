export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string; // Optional student register number
  department?: string;
  createdAt: string;
}

export interface ClassSession {
  id: string;
  teacherId: string;
  className: string;
  subjectCode: string; // e.g., CS-101
  sessionCode: string; // unique random code embedded in the QR
  isActive: boolean;
  createdAt: string;
  expiresAt: string; // ISO string indicating expiration
  durationMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  sessionCode: string;
  className: string;
  subjectCode: string;
  studentId: string; // Document uid of the student
  studentName: string;
  studentEmail: string;
  studentRegNo: string; // Student ID card number
  scannedAt: string;
  deviceInfo?: string;
  checkInMethod: 'qr_scan' | 'manual_code';
  status: 'present' | 'late';
  department?: string;
}
