import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { optimizeImageTo300x300 } from '../../utils/imageOptimizer';
import { TesterTab, TesterPost } from './types';
import { TesterAuthModal } from './TesterAuthModal';
import {
  X,
  Plus,
  Send,
  Image as ImageIcon,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Megaphone,
  User as UserIcon,
  Loader2,
  Maximize2
} from 'lucide-react';

interface TestersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: TesterTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: 'announcements',
    label: 'Announcements',
    icon: Megaphone
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare
  },
  {
    id: 'bug_reports',
    label: 'Bug Reports',
    icon: AlertTriangle
  },
  {
    id: 'suggestions',
    label: 'Suggestions',
    icon: Lightbulb
  }
];

export const TestersModal: React.FC<TestersModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TesterTab>('chat');
  const [posts, setPosts] = useState<TesterPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [optimizingImage, setOptimizingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // User auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Listen to Firestore collection for the active tab
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setErrorMessage(null);
    const colName = `testers_${activeTab}`;

    try {
      const q = query(collection(db, colName), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list: TesterPost[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              tab: activeTab,
              content: data.content || '',
              imageUrl: data.imageUrl || undefined,
              authorName: data.authorName || 'Tester',
              authorId: data.authorId,
              authorBadge: data.authorBadge || 'TESTER',
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
            });
          });
          setPosts(list);
          setLoading(false);
        },
        (err) => {
          console.warn('Firestore subscription error:', err);
          setErrorMessage('Firestore: ' + err.message);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (err: any) {
      console.warn('Failed to bind Firestore listener:', err);
      setLoading(false);
    }
  }, [activeTab, isOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts, activeTab]);

  // Handle image files from upload or clipboard paste
  const processImageFile = async (file: File | Blob) => {
    try {
      setOptimizingImage(true);
      setErrorMessage(null);
      const optimizedWebp = await optimizeImageTo300x300(file);
      setStagedImage(optimizedWebp);
    } catch (err: any) {
      setErrorMessage('Failed to optimize image: ' + err.message);
    } finally {
      setOptimizingImage(false);
    }
  };

  // Clipboard Paste handler for screenshots (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Every tab supports text, image, or both
    if (!inputText.trim() && !stagedImage) {
      return;
    }

    setSending(true);
    setErrorMessage(null);

    const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Tester ' + Math.floor(Math.random() * 900 + 100);
    const authorId = currentUser?.uid || 'guest';
    const authorBadge = currentUser?.uid ? 'TESTER' : 'GUEST';

    const colName = `testers_${activeTab}`;

    try {
      await addDoc(collection(db, colName), {
        tab: activeTab,
        content: inputText.trim(),
        imageUrl: stagedImage || null,
        authorName,
        authorId,
        authorBadge,
        createdAt: serverTimestamp()
      });

      setInputText('');
      setStagedImage(null);
    } catch (err: any) {
      console.error('Error posting message:', err);
      if (err.code === 'permission-denied') {
        setErrorMessage('Permission denied by Firestore rules. Please verify security rules.');
      } else {
        setErrorMessage('Failed to send: ' + err.message);
      }
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const currentTabConfig = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div
      id="testers-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs select-none"
      onPaste={handlePaste}
    >
      <div
        id="testers-modal-window"
        className="w-[95vw] md:w-[75vw] h-[90vh] md:h-[75vh] max-w-6xl bg-[#0b0b0e] text-[#e0e0e3] border border-[#1e1e24] rounded-xl shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Top Header Bar: Tabs & Account controls */}
        <div className="bg-[#121216] border-b border-[#1c1c22] px-3 py-2 sm:px-4 flex items-center justify-between gap-2">
          {/* Left: Tab list */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tester-tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setErrorMessage(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#88888e] hover:bg-[#1a1a20] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Account profile & Close */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              id="tester-account-btn"
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 bg-[#17171d] hover:bg-[#202028] border border-[#262630] px-2.5 py-1.5 rounded-md text-xs font-medium text-white transition-colors cursor-pointer"
              title={currentUser ? `Logged in as ${currentUser.displayName || currentUser.email}` : 'Sign In or Create Account'}
            >
              <div className="w-4 h-4 rounded-full bg-[#2a2a35] border border-[#3b3b4a] flex items-center justify-center text-[10px] font-bold text-white">
                {currentUser ? (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase() : <UserIcon className="w-2.5 h-2.5" />}
              </div>
              <span className="max-w-[100px] truncate text-xs">
                {currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0]) : 'Account'}
              </span>
            </button>

            <button
              id="tester-close-btn"
              onClick={onClose}
              className="text-[#88888e] hover:text-white p-1.5 rounded-md hover:bg-[#1a1a20] transition-colors cursor-pointer"
              title="Close window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Channel Subheader */}
        <div className="bg-[#0e0e12] px-4 py-2 border-b border-[#1a1a20] flex items-center text-xs text-[#88888e]">
          <span className="font-semibold text-white">#{currentTabConfig.label.toLowerCase().replace(/\s+/g, '-')}</span>
        </div>

        {/* Main Content: Posts Feed */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#0b0b0e]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#77777d] gap-2 py-12">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span className="text-xs">Loading posts...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#77777d] gap-2 py-16 text-center max-w-sm mx-auto">
              <div className="w-10 h-10 rounded-full bg-[#141418] border border-[#22222a] flex items-center justify-center text-[#66666e]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">#{currentTabConfig.label}</h4>
                <p className="text-xs text-[#77777d] mt-0.5">
                  No messages yet. Send a message or attach an image to start!
                </p>
              </div>
            </div>
          ) : (
            posts.map((post) => {
              const formattedDate = new Date(post.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={post.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#121217] transition-colors group"
                >
                  {/* User Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#181820] border border-[#262632] flex items-center justify-center text-white font-bold text-xs shrink-0 select-none mt-0.5">
                    {(post.authorName || 'T')[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header: Name + Badge + Timestamp */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-xs">
                        {post.authorName}
                      </span>
                      {post.authorBadge && (
                        <span className="bg-[#181820] border border-[#262632] text-[#aaaaae] text-[9px] font-medium px-1.5 py-0.2 rounded">
                          {post.authorBadge}
                        </span>
                      )}
                      <span className="text-[10px] text-[#66666e]">
                        {formattedDate}
                      </span>
                    </div>

                    {/* Text Message content */}
                    {post.content && (
                      <p className="text-xs text-[#d0d0d5] break-words whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    )}

                    {/* Optimized 300x300 Image Attachment */}
                    {post.imageUrl && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={post.imageUrl}
                          alt="Attachment"
                          className="max-w-[300px] max-h-[300px] rounded-md border border-[#202028] object-contain bg-[#121216] cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPreviewImage(post.imageUrl || null)}
                        />
                        <button
                          onClick={() => setSelectedPreviewImage(post.imageUrl || null)}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-black text-white rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                          title="Expand image"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="bg-[#2b1416] border-t border-[#461e22] px-4 py-2 text-[#ff8080] text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-[#ff8080] hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="bg-[#0e0e12] p-3 border-t border-[#1a1a20]">
          {/* Staged Image Preview */}
          {stagedImage && (
            <div className="mb-2 p-2 bg-[#141418] rounded-lg border border-[#22222a] flex items-center justify-between w-fit gap-3">
              <div className="relative">
                <img
                  src={stagedImage}
                  alt="Staged attachment"
                  className="w-14 h-14 object-cover rounded border border-[#22222a]"
                />
              </div>
              <div className="text-xs">
                <p className="font-medium text-white">Image attached</p>
                <p className="text-[10px] text-[#77777d]">300×300 WebP</p>
              </div>
              <button
                type="button"
                onClick={() => setStagedImage(null)}
                className="p-1 text-[#88888e] hover:text-white rounded hover:bg-[#1e1e24] transition-colors cursor-pointer"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 bg-[#141418] rounded-lg px-3 py-2 border border-[#22222a] focus-within:border-[#444452] transition-colors"
          >
            {/* File / photo upload button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              id="tester-upload-plus-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={optimizingImage || sending}
              className="w-6 h-6 rounded-md bg-[#1e1e26] hover:bg-[#282834] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Attach image (or paste Ctrl+V)"
            >
              {optimizingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-[#cccccc]" />
              )}
            </button>

            {/* Input field */}
            <input
              type="text"
              id="tester-message-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message #${currentTabConfig.label.toLowerCase()}...`}
              className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-[#666670]"
            />

            {/* Send button */}
            <button
              type="submit"
              id="tester-send-btn"
              disabled={sending || optimizingImage || (!inputText.trim() && !stagedImage)}
              className="p-1.5 rounded-md text-black bg-white hover:bg-[#e0e0e5] disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer shrink-0"
              title="Send"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
              ) : (
                <Send className="w-3.5 h-3.5 text-black" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Lightbox Modal for clicked image */}
      {selectedPreviewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div className="relative max-w-xl max-h-[85vh]">
            <img
              src={selectedPreviewImage}
              alt="Expanded preview"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-[#2a2a30]"
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-[#222228] text-white rounded-full border border-[#444] shadow-lg hover:bg-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <TesterAuthModal
          currentUser={currentUser}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
};
