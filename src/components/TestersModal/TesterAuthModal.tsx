import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  User
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { X, User as UserIcon, Mail, Lock, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

interface TesterAuthModalProps {
  currentUser: User | null;
  onClose: () => void;
}

export const TesterAuthModal: React.FC<TesterAuthModalProps> = ({ currentUser, onClose }) => {
  const [isRegister, setIsRegister] = useState(!currentUser);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!username.trim()) {
          throw new Error('Please enter a username');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: username.trim() });

        // Save user record to Firestore
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            username: username.trim(),
            email: email.trim(),
            badge: 'TESTER',
            createdAt: Date.now()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Could not write user profile to firestore:', dbErr);
        }

        setSuccess('Account created successfully');
        setTimeout(() => onClose(), 600);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setSuccess('Logged in successfully');
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Try logging in.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (err: any) {
      setError('Failed to sign out: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-[#0e0e10] text-[#e0e0e0] border border-[#222225] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#141416] px-4 py-3 flex items-center justify-between border-b border-[#1f1f23]">
          <h3 className="text-sm font-semibold text-white tracking-tight">
            {currentUser ? 'Tester Account' : isRegister ? 'Create Account' : 'Sign In'}
          </h3>
          <button
            onClick={onClose}
            className="text-[#777777] hover:text-white p-1 rounded hover:bg-[#1e1e22] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {currentUser ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 bg-[#131316] rounded-lg border border-[#202024]">
                <div className="w-10 h-10 rounded-full bg-[#202025] border border-[#2e2e34] flex items-center justify-center text-white font-bold text-sm">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">
                      {currentUser.displayName || 'Tester'}
                    </span>
                    <span className="bg-[#1e1e24] border border-[#2d2d35] text-[#b0b0b8] text-[9px] font-medium px-1.5 py-0.2 rounded">
                      TESTER
                    </span>
                  </div>
                  <p className="text-xs text-[#777777] truncate">{currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full mt-1 bg-[#1a1a1e] hover:bg-[#25252a] text-[#ff6b6b] border border-[#2d2d35] py-2 px-4 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {error && (
                <div className="p-2.5 bg-[#2a1416] border border-[#441f23] rounded-md text-[#ff8080] text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-2.5 bg-[#14261a] border border-[#1f422b] rounded-md text-[#66e088] text-xs flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {isRegister && (
                <div>
                  <label className="block text-[11px] font-medium text-[#888888] mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-[#555555] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#141417] text-white pl-8 pr-3 py-1.5 rounded-md text-xs border border-[#242429] focus:border-white focus:outline-none transition-colors placeholder-[#555555]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-[#888888] mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#555555] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#141417] text-white pl-8 pr-3 py-1.5 rounded-md text-xs border border-[#242429] focus:border-white focus:outline-none transition-colors placeholder-[#555555]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#888888] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#555555] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#141417] text-white pl-8 pr-3 py-1.5 rounded-md text-xs border border-[#242429] focus:border-white focus:outline-none transition-colors placeholder-[#555555]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-white text-black hover:bg-[#e0e0e0] py-2 px-4 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>

              <div className="text-center mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError(null);
                  }}
                  className="text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
                >
                  {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
