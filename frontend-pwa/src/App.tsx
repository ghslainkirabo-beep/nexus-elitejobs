import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Users, CheckCircle, Smartphone, Bell, Send, RefreshCw, Lock, LogOut, Sparkles, Clock } from 'lucide-react';

const API_URL = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080/ws';

type Role = 'OWNER' | 'HR_MANAGER' | 'IT_SUPPORT' | 'HELPDESK' | 'RECEPTIONIST';

interface User {
  id: string;
  name: string;
  role: Role;
  pin: string;
}

const REGISTERED_USERS: User[] = [
  { id: 'USR-OWNER', name: 'Company Owner (Admin)', role: 'OWNER', pin: '0000' },
  { id: 'USR-HR', name: 'HR Manager', role: 'HR_MANAGER', pin: '1111' },
  { id: 'USR-IT', name: 'Guapo (IT Support Core)', role: 'IT_SUPPORT', pin: '7777' },
  { id: 'USR-HELP', name: 'Helpdesk Agent', role: 'HELPDESK', pin: '2222' },
  { id: 'USR-REC', name: 'Receptionist', role: 'RECEPTIONIST', pin: '3333' },
];

export default function App() {
  const [loadingPhase, setLoadingPhase] = useState<boolean>(true);
  const [loaderProgress, setLoaderProgress] = useState<number>(0);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User>(REGISTERED_USERS[2]);
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [currentQR, setCurrentQR] = useState<{ token: string; createdAt: string } | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanStatus, setScanStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [iosNotifications, setIosNotifications] = useState<any[]>([]);
  
  const [isOffWork, setIsOffWork] = useState<boolean>(false);
  const [synthesizedDailyReport, setSynthesizedDailyReport] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setLoaderProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setLoadingPhase(false), 500);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const ws = new WebSocket(`${WS_URL}?role=${selectedUser.role}&user_id=${selectedUser.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ATTENDANCE_VERIFIED' || data.type === 'NEW_REPORT') {
        setIosNotifications((prev) => [data.payload, ...prev]);
      }
    };

    return () => { ws.close(); };
  }, [isAuthenticated, selectedUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchQR();
      fetchRecords();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === selectedUser.pin) {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid PIN code. Contact IT Support (Guapo) or Owner.');
    }
  };

  const fetchQR = async () => {
    try {
      const res = await fetch(`${API_URL}/api/qr/current`);
      const data = await res.json();
      setCurrentQR(data);
    } catch (err) { console.error(err); }
  };

  const generateNewQR = async () => {
    try {
      const res = await fetch(`${API_URL}/api/qr/generate`, { method: 'POST' });
      const data = await res.json();
      setCurrentQR(data);
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/records`);
      const data = await res.json();
      setAttendanceRecords(data || []);
    } catch (err) { console.error(err); }
  };

  const handleScan = async (tokenToScan: string) => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          user_name: selectedUser.name,
          role: selectedUser.role,
          token: tokenToScan,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setScanStatus({ success: true, message: 'Welcome again on Elite Jobs! Attendance verified successfully ✅' });
      fetchRecords();
    } catch (err: any) {
      setScanStatus({ success: false, message: err.message || 'Scan Failed' });
    }
  };

  const handleClockOutShift = () => {
    setIsOffWork(true);
    const synthesized = `[ELITEJOBS AUTOMATED DAILY REPORT]\n` +
      `Staff: ${selectedUser.name} (${selectedUser.role})\n` +
      `Date: ${new Date().toLocaleDateString()}\n` +
      `Status: Shift Completed (17:00 Clock-Out)\n\n` +
      `--- SUMMARY ---\nAll assigned tasks for BK Arena operations successfully completed with zero anomalies.`;
    setSynthesizedDailyReport(synthesized);
  };

  const exportAndSendToHR = async () => {
    try {
      await fetch(`${API_URL}/api/reports/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: selectedUser.id,
          author_name: selectedUser.name,
          author_role: selectedUser.role,
          recipient: 'HR_MANAGER',
          title: `Daily Shift Report - ${selectedUser.name}`,
          content: synthesizedDailyReport,
        }),
      });
      alert('Report exported successfully to HR Manager!');
    } catch (err) { alert('Failed to export report'); }
  };

  if (loadingPhase) {
    return (
      <div className="fixed inset-0 bg-[#09090B] flex flex-col items-center justify-center z-[9999] text-[#FAFAFA]">
        <div className="w-20 h-20 bg-[#D4AF37] text-[#09090B] rounded-3xl flex items-center justify-center font-black text-3xl shadow-2xl animate-pulse">
          EJ
        </div>
        <div className="text-center space-y-2 mt-4">
          <h1 className="text-2xl font-black tracking-widest uppercase">EliteJobs Nexus</h1>
          <p className="text-xs text-[#A1A1AA] font-mono">BK ARENA ENTERPRISE ECOSYSTEM</p>
        </div>
        <div className="w-64 h-1 bg-[#18181B] rounded-full overflow-hidden border border-[#27272A] mt-6">
          <div className="h-full bg-[#D4AF37] transition-all duration-200" style={{ width: `${loaderProgress}%` }}></div>
        </div>
        <span className="text-xs font-mono text-[#D4AF37] mt-2">{loaderProgress}% INITIALIZED</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#18181B] border border-[#27272A] rounded-3xl p-8 shadow-2xl relative">
          <div className="flex items-center space-x-3 mb-8">
            <div className="bg-[#D4AF37] text-[#09090B] p-3 rounded-2xl font-black shadow-xl">EJ</div>
            <div>
              <h1 className="text-xl font-bold text-white">EliteJobs Gateway</h1>
              <p className="text-xs text-[#A1A1AA]">Secure Enterprise Authentication</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-2">Select Assigned Role & User</label>
              <select
                value={selectedUser.id}
                onChange={(e) => {
                  const found = REGISTERED_USERS.find(u => u.id === e.target.value);
                  if (found) setSelectedUser(found);
                }}
                className="w-full bg-[#09090B] border border-[#27272A] text-[#FAFAFA] rounded-2xl px-4 py-3 text-sm outline-none font-medium cursor-pointer"
              >
                {REGISTERED_USERS.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-2">Security PIN Code</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-[#A1A1AA]" size={16} />
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  required
                  className="w-full bg-[#09090B] border border-[#27272A] text-[#FAFAFA] rounded-2xl pl-12 pr-4 py-3 text-sm tracking-widest font-mono outline-none"
                />
              </div>
            </div>
            {loginError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs font-semibold">{loginError}</div>}
            <button type="submit" className="w-full bg-[#D4AF37] text-[#09090B] font-bold py-3.5 rounded-2xl text-sm transition shadow-xl">
              Authenticate & Launch Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#09090B', color: '#FAFAFA', minHeight: '100vh' }} className="flex flex-col">
      <header style={{ backgroundColor: '#09090B', borderBottom: '1px solid #27272A' }} className="px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div style={{ backgroundColor: '#D4AF37', color: '#09090B' }} className="p-2.5 rounded-xl font-black shadow-xl">EJ</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              EliteJobs Enterprise Core <span className="text-xs bg-[#18181B] text-[#D4AF37] border border-[#27272A] px-2 py-0.5 rounded-full font-mono">Dedicated Native App</span>
            </h1>
            <p className="text-xs text-[#A1A1AA]">Role: <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.role})</p>
          </div>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold transition"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {selectedUser.role === 'IT_SUPPORT' ? (
            <div style={{ backgroundColor: '#18181B', borderColor: '#27272A' }} className="border rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <QrCode style={{ color: '#D4AF37' }} /> IT Master QR Generator (PC Workstation)
                </h2>
                <button
                  onClick={generateNewQR}
                  style={{ backgroundColor: '#D4AF37', color: '#09090B' }}
                  className="flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl text-sm transition shadow-lg"
                >
                  <RefreshCw size={16} /> Refresh QR
                </button>
              </div>
              <div className="bg-[#09090B] border border-[#27272A] p-6 rounded-xl flex flex-col items-center justify-center font-mono text-center">
                <div className="bg-[#FAFAFA] text-[#09090B] w-48 h-48 rounded-xl flex flex-col items-center justify-center p-4 font-bold shadow-2xl">
                  <QrCode size={64} className="mb-2" />
                  <span>SECURE TOKEN</span>
                  <span className="text-[10px] text-zinc-500 mt-1 truncate w-full">{currentQR?.token || 'Loading...'}</span>
                </div>
                <span className="text-xs mt-4 flex items-center gap-1 font-semibold text-[#D4AF37]">
                  <CheckCircle size={14} /> Active & Cryptographically Signed
                </span>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#18181B', borderColor: '#27272A' }} className="border rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-2 text-white">
                <Smartphone style={{ color: '#D4AF37' }} /> Mobile Attendance Scanner App
              </h2>
              <p className="text-sm text-[#A1A1AA] mb-6">Point camera at IT Support PC screen or verify token below.</p>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan QR token..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className="flex-1 bg-[#09090B] border border-[#27272A] text-white rounded-xl px-4 py-3 text-sm outline-none font-mono"
                  />
                  <button
                    onClick={() => handleScan(scanInput || (currentQR ? currentQR.token : ''))}
                    style={{ backgroundColor: '#D4AF37', color: '#09090B' }}
                    className="font-bold px-6 py-3 rounded-xl text-sm transition shadow-lg"
                  >
                    Scan & Verify
                  </button>
                </div>
                {scanStatus && (
                  <div className="bg-[#09090B] border border-[#27272A] text-[#D4AF37] p-4 rounded-xl border flex items-center gap-3 font-semibold text-sm">
                    <CheckCircle size={24} className="shrink-0" />
                    <div>{scanStatus.message}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: '#18181B', borderColor: '#27272A' }} className="border rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-white">
              <Clock style={{ color: '#D4AF37' }} /> Daily Shift Operations & 17:00 Report Tray
            </h2>
            {!isOffWork ? (
              <button
                onClick={handleClockOutShift}
                className="w-full bg-[#27272A] hover:bg-[#3f3f46] text-white font-bold py-3.5 rounded-xl text-sm transition border border-[#3f3f46] flex items-center justify-center gap-2"
              >
                <Sparkles size={16} className="text-[#D4AF37]" /> Click When You Are Off ("I'm Off" at 17:00)
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#09090B] border border-[#27272A] p-4 rounded-xl font-mono text-xs text-white whitespace-pre-line">
                  {synthesizedDailyReport}
                </div>
                <button
                  onClick={exportAndSendToHR}
                  style={{ backgroundColor: '#D4AF37', color: '#09090B' }}
                  className="w-full font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <Send size={16} /> Export & Supply Report to HR
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div style={{ backgroundColor: '#18181B', borderColor: '#27272A' }} className="border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-md font-bold flex items-center gap-2 mb-4 text-white">
              <Bell style={{ color: '#D4AF37' }} /> Live Notifications (IT & Admin)
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {iosNotifications.length === 0 ? (
                <p className="text-xs italic text-[#A1A1AA]">Listening for real-time scans...</p>
              ) : (
                iosNotifications.map((notif, idx) => (
                  <div key={idx} className="bg-[#09090B] border border-[#27272A] p-3 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold text-[#D4AF37]">
                      <span>{notif.UserName || notif.author_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded border bg-[#18181B] border-[#27272A] text-white">{notif.UserRole || notif.author_role}</span>
                    </div>
                    <p className="text-white">Marked present at BK Arena!</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#18181B', borderColor: '#27272A' }} className="border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-md font-bold flex items-center gap-2 mb-4 text-white">
              <Users style={{ color: '#D4AF37' }} /> Today's Verified Attendance
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 font-mono text-xs">
              {attendanceRecords.length === 0 ? (
                <p className="italic font-sans text-[#A1A1AA]">No attendance records yet today.</p>
              ) : (
                attendanceRecords.map((rec) => (
                  <div key={rec.id} className="bg-[#09090B] border border-[#27272A] p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{rec.user_name}</div>
                      <div className="text-[10px] text-[#A1A1AA]">{rec.user_role}</div>
                    </div>
                    <div className="text-right">
                      <span className="flex items-center gap-1 font-semibold text-[#D4AF37]">
                        <CheckCircle size={12} /> {rec.status}
                      </span>
                      <span className="text-[10px] text-[#A1A1AA]">{new Date(rec.scannedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}