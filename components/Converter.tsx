import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Link2, 
  Download, 
  Youtube, 
  Facebook, 
  Instagram, 
  Twitter, 
  CheckCircle,
  Loader2,
  History,
  Upload,
  X,
  Trash2,
  Search,
  RotateCw,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Settings2,
  VolumeX,
  Volume2,
  Maximize2,
  Music,
  Image,
  AudioLines,
  Zap,
  Cpu
} from 'lucide-react';
import { AppState, FileFormat, Platform, ConverterProps, HistoryItem, BatchItem, ConversionResult, VideoResolution, AudioBitrate, ImageQuality, AudioCodec } from '../types';
import { convertMedia } from '../services/api';

// --- Helper Component for Segmented Controls ---
const SegmentedControl = <T extends string>({
  options,
  value,
  onChange
}: {
  options: T[];
  value: T;
  onChange: (val: T) => void;
}) => {
  const selectedIndex = options.indexOf(value);
  const count = options.length;

  return (
    <div className="segment-group">
      {/* Animated Glider Background */}
      <motion.div
        className="segment-glider"
        initial={false}
        animate={{
          // Calculate left position based on index and total count
          // 6px is the left padding (matches CSS)
          // 12px is total horizontal padding (6px left + 6px right)
          left: `calc(6px + (100% - 12px) / ${count} * ${selectedIndex})`,
          width: `calc((100% - 12px) / ${count})`
        }}
        // Using a tighter spring to match the "snap" of the toggle switch
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      />
      
      {/* Foreground Buttons */}
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`segment-btn ${value === opt ? 'active' : ''}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

const Converter: React.FC<ConverterProps> = ({ appState, setAppState }) => {
  // Mode State
  const [mode, setMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');

  // Input State
  const [url, setUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.UNKNOWN);
  const [format, setFormat] = useState<FileFormat>(FileFormat.MP4);
  
  // Internal category state for UI (VIDEO | AUDIO | IMG)
  const [category, setCategory] = useState<'VIDEO' | 'AUDIO' | 'IMG'>('VIDEO');

  // Advanced Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [resolution, setResolution] = useState<VideoResolution>('1080p');
  const [bitrate, setBitrate] = useState<AudioBitrate>('192k');
  const [audioCodec, setAudioCodec] = useState<AudioCodec>('AAC');
  const [imgQuality, setImgQuality] = useState<ImageQuality>('HIGH');
  const [muteAudio, setMuteAudio] = useState(false);
  // GPU Enabled by default, toggle removed
  const [gpuEnabled, setGpuEnabled] = useState(true);

  // Process State
  const [progress, setProgress] = useState(0);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Result State (Single Mode)
  const [singleResult, setSingleResult] = useState<ConversionResult | null>(null);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // UI State
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update Category when format changes externally (e.g. from history)
  useEffect(() => {
    if (format === FileFormat.MP4) setCategory('VIDEO');
    else if (format === FileFormat.MP3) setCategory('AUDIO');
    else setCategory('IMG');
  }, [format]);

  // Load History on Mount
  useEffect(() => {
    const saved = localStorage.getItem('znyth_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save History
  const addToHistory = (item: HistoryItem) => {
    const newHistory = [item, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('znyth_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('znyth_history');
  };

  // Auto-detect platform (Single Mode)
  useEffect(() => {
    if (mode === 'SINGLE') {
      setPlatform(detectPlatform(url));
      if (url) setError(null); // Clear error when user types
    }
  }, [url, mode]);

  const detectPlatform = (u: string): Platform => {
    if (!u) return Platform.UNKNOWN;
    const lowerUrl = u.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return Platform.YOUTUBE;
    else if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return Platform.FACEBOOK;
    else if (lowerUrl.includes('instagram.com')) return Platform.INSTAGRAM;
    else if (lowerUrl.includes('tiktok.com')) return Platform.TIKTOK;
    else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return Platform.TWITTER;
    return Platform.UNKNOWN;
  };

  // Smart Paste Handler
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const matches = text.match(/https?:\/\//gi);
    const count = matches ? matches.length : 0;

    if (count > 1) {
      e.preventDefault();
      const formatted = text
        .replace(/(https?:\/\/)/gi, '\n$1')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join('\n');

      if (mode === 'SINGLE') {
        setMode('BATCH');
        setBatchText(formatted);
        setUrl(''); 
        setError(null);
      } else {
        const target = e.target as HTMLTextAreaElement;
        const val = target.value;
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const prefix = (start > 0 && val[start - 1] !== '\n') ? '\n' : '';
        const newVal = val.substring(0, start) + prefix + formatted + val.substring(end);
        setBatchText(newVal);
      }
    } 
    else if (mode === 'BATCH' && count === 1) {
       const target = e.target as HTMLTextAreaElement;
       const val = target.value;
       const start = target.selectionStart || 0;
       if (start > 0 && val[start - 1] !== '\n') {
          e.preventDefault();
          const end = target.selectionEnd || 0;
          const newVal = val.substring(0, start) + '\n' + text + val.substring(end);
          setBatchText(newVal);
       }
    }
  };

  const handleConvert = async () => {
    if (!url) return;
    setAppState(AppState.PROCESSING);
    setProgress(0);
    setError(null);
    setSingleResult(null);

    // Fake progress bar for visual feedback while awaiting the "API"
    // Faster progress if GPU enabled
    const step = gpuEnabled ? 15 : 5;
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + Math.random() * step : prev));
    }, 300);

    try {
      // Call the Service with Options
      const options = { 
        resolution, 
        bitrate, 
        quality: imgQuality, 
        codec: audioCodec, 
        mute: muteAudio, 
        gpuAcceleration: gpuEnabled 
      };
      
      const result = await convertMedia(url, format, options);
      
      clearInterval(interval);
      setProgress(100);
      setSingleResult(result); // Store result for download
      
      // Slight delay to show 100% before switching view
      setTimeout(() => {
        setAppState(AppState.SUCCESS);
        addToHistory({
          id: Date.now().toString(),
          url,
          platform: detectPlatform(url),
          format,
          timestamp: Date.now()
        });
      }, 500);

    } catch (err: any) {
      clearInterval(interval);
      setAppState(AppState.IDLE);
      setError(err.message || "Unable to process this URL. Please check the link and try again.");
    }
  };

  // Helper to process a queue of batch items
  const processBatchQueue = async (itemsToProcess: BatchItem[]) => {
    for (const item of itemsToProcess) {
      // Update status to PROCESSING
      setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'PROCESSING', error: undefined } : i));
      
      try {
        // Mock progress for individual item
        const pInterval = setInterval(() => {
             setBatchItems(prev => prev.map(i => i.id === item.id && i.progress < 90 ? { ...i, progress: i.progress + 10 } : i));
        }, 300);

        // Pass settings even for batch (using current settings for all)
        const options = { resolution, bitrate, quality: imgQuality, codec: audioCodec, mute: muteAudio, gpuAcceleration: gpuEnabled };
        const result = await convertMedia(item.url, FileFormat.MP4, options); // Default to MP4 for batch, or use current format? Keeping as MP4 default for batch logic simplicity in this demo
        
        clearInterval(pInterval);

        setBatchItems(prev => prev.map(i => i.id === item.id ? { 
          ...i, 
          status: 'COMPLETED',
          progress: 100,
          result: result
        } : i));

        addToHistory({
          id: item.id,
          url: item.url,
          platform: item.platform,
          format: FileFormat.MP4, // Assuming batch forces MP4 for this logic
          timestamp: Date.now()
        });

      } catch (err) {
        setBatchItems(prev => prev.map(i => i.id === item.id ? { 
           ...i, 
           status: 'FAILED', 
           progress: 0,
           error: "Conversion Failed" 
        } : i));
      }
    }

    setAppState(AppState.SUCCESS);
  };

  const handleBatchConvert = async () => {
    if (!batchText.trim()) return;
    const urls = batchText.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return;

    setAppState(AppState.PROCESSING);
    setError(null);

    const items: BatchItem[] = urls.map((u, i) => ({
      id: `batch-${i}-${Date.now()}`,
      url: u,
      platform: detectPlatform(u),
      status: 'PENDING',
      progress: 0
    }));
    setBatchItems(items);

    await processBatchQueue(items);
  };

  const handleRetryFailed = async () => {
    const failedItems = batchItems.filter(i => i.status === 'FAILED');
    if (failedItems.length === 0) return;

    setAppState(AppState.PROCESSING);
    
    // Reset status in UI immediately
    setBatchItems(prev => prev.map(i => i.status === 'FAILED' ? { ...i, status: 'PENDING', progress: 0, error: undefined } : i));

    await processBatchQueue(failedItems);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setBatchText(event.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent flickering when dragging over child elements
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Check for text file type or extension
      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setBatchText(event.target.result as string);
            setError(null); // Clear any previous errors
          }
        };
        reader.readAsText(file);
      } else {
        setError("Invalid file type. Please upload a .txt file.");
      }
    }
  };

  const handleDownload = (result?: ConversionResult) => {
    if (!result) return;
    
    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    link.href = result.downloadUrl;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchDownload = () => {
    // In a real app, this might zip the files. 
    // Here we just trigger individual downloads for completed items.
    const completed = batchItems.filter(i => i.status === 'COMPLETED' && i.result);
    completed.forEach(item => {
      if (item.result) handleDownload(item.result);
    });
  };

  const reset = () => {
    setAppState(AppState.IDLE);
    setUrl('');
    setBatchText('');
    setProgress(0);
    setBatchItems([]);
    setSingleResult(null);
    setPlatform(Platform.UNKNOWN);
    setError(null);
  };

  const getPlatformIcon = (p: Platform, isActive = false) => {
    const style = isActive ? "text-white drop-shadow-sm" : "text-gray-400";
    
    // Custom TikTok SVG since Lucide doesn't provide a branded one
    const TikTokIcon = ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    );

    switch (p) {
      case Platform.YOUTUBE: return <Youtube className={`w-6 h-6 ${style}`} />;
      case Platform.FACEBOOK: return <Facebook className={`w-6 h-6 ${style}`} />;
      case Platform.INSTAGRAM: return <Instagram className={`w-6 h-6 ${style}`} />;
      case Platform.TIKTOK: return <TikTokIcon className={`w-6 h-6 ${style}`} />;
      case Platform.TWITTER: return <Twitter className={`w-6 h-6 ${style}`} />;
      default: return <Link2 className={`w-6 h-6 ${style}`} />;
    }
  };

  const getCategoryIcon = (cat: 'VIDEO' | 'AUDIO' | 'IMG') => {
     switch(cat) {
        case 'AUDIO': return <FileAudio className="w-5 h-5 md:w-4 md:h-4" />;
        case 'VIDEO': return <FileVideo className="w-5 h-5 md:w-4 md:h-4" />;
        case 'IMG': return <ImageIcon className="w-5 h-5 md:w-4 md:h-4" />;
        default: return <Link2 className="w-5 h-5 md:w-4 md:h-4" />
     }
  }

  // Calculate stats for batch
  const failedItems = batchItems.filter(i => i.status === 'FAILED');
  const completedItems = batchItems.filter(i => i.status === 'COMPLETED');
  const hasFailures = failedItems.length > 0;

  // Handler for toggle logic to keep DRY
  const toggleMode = () => {
    const newMode = mode === 'SINGLE' ? 'BATCH' : 'SINGLE';
    setMode(newMode);
    setError(null);
  };

  // Determine which settings to show based on format
  const isVideo = category === 'VIDEO';
  const isAudio = category === 'AUDIO';
  const isImage = category === 'IMG';

  return (
    <>
      {/* HISTORY SIDEBAR */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-gray-600/10 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[85%] sm:max-w-sm z-50 bg-[#e8e8e8] shadow-2xl flex flex-col"
            >
              <div className="p-6 md:p-8 flex justify-between items-center z-10">
                <h2 className="text-xl md:text-2xl font-black text-gray-700 flex items-center gap-3">
                  <History className="w-5 h-5 md:w-6 md:h-6 text-[#4B9BFF]" />
                  History
                </h2>
                <button 
                  onClick={() => setShowHistory(false)} 
                  className="p-3 rounded-full hover:bg-white/50 text-gray-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                {history.length === 0 ? (
                  <div className="text-center text-gray-400 py-20 font-medium">No recent conversions.</div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="neo-btn p-4 md:p-5 group flex flex-col gap-3 rounded-3xl">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="p-2 neo-pressed rounded-full text-[#4B9BFF]">
                            {getPlatformIcon(item.platform, false)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                            <span className="text-xs font-bold text-[#4B9BFF]">{item.format}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 font-medium truncate w-full opacity-80">{item.url}</p>
                      
                      <button 
                        onClick={() => {
                          setMode('SINGLE');
                          setUrl(item.url);
                          setFormat(item.format);
                          setShowHistory(false);
                          setError(null);
                        }}
                        className="mt-2 w-full py-3 neo-btn rounded-xl text-xs font-bold text-gray-500 flex items-center justify-center gap-2 hover:text-[#4B9BFF] transition-colors"
                      >
                         <RotateCw className="w-3 h-3" /> Re-Process
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              {history.length > 0 && (
                <div className="p-6 md:p-8 border-t border-gray-200/50">
                  <button onClick={clearHistory} className="w-full py-4 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 rounded-2xl transition-colors text-sm font-bold neo-btn">
                    <Trash2 className="w-4 h-4" /> Clear All History
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] p-4 md:p-12 pb-24">
        
        {/* Toggle History Button - Refined Neomorphism */}
        <button 
          onClick={() => setShowHistory(true)}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 md:w-16 md:h-16 flex items-center justify-center neo-btn rounded-full z-30 text-gray-500 hover:text-[#4B9BFF] hover:scale-110 active:scale-95 transition-all duration-300"
          title="View History"
        >
          <History className="w-6 h-6 md:w-7 md:h-7" />
        </button>

        <AnimatePresence mode="wait">
          
          {/* MAIN CONVERTER CARD */}
          {(appState === AppState.IDLE || appState === AppState.PROCESSING) && (
            <motion.div
              key="input-card"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
              className="w-full max-w-2xl"
            >
              <div className="neo-flat px-5 py-8 md:p-16 relative overflow-hidden">
                
                {/* Hero Header */}
                <div className="text-center space-y-3 md:space-y-4 mb-8 md:mb-12">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-800 tracking-tight">
                    Znyth<span className="text-[#4B9BFF]">Converter</span>
                  </h1>
                  <p className="text-[#666666] font-medium text-base md:text-lg leading-relaxed max-w-lg mx-auto">
                    Seamlessly transform video, audio, and images from any platform into high-fidelity formats.
                  </p>
                </div>

                {/* Main Content */}
                <div className="space-y-8 md:space-y-10">
                  
                  {/* Mode Toggle Switch - Accessible & Centered */}
                  <div className="flex justify-center mb-2">
                    <div 
                      className="skeuo-track p-1 flex relative w-full max-w-[20rem] mx-auto h-16 md:h-18 cursor-pointer rounded-full"
                      onClick={toggleMode}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleMode();
                        }
                      }}
                      role="switch"
                      aria-checked={mode === 'BATCH'}
                      tabIndex={0}
                      aria-label="Toggle between Single and Batch mode"
                    >
                      {/* Animated Knob */}
                      <motion.div 
                        className="absolute top-2 bottom-2 skeuo-knob z-10"
                        initial={false}
                        animate={{ 
                          left: mode === 'SINGLE' ? '8px' : 'calc(50% + 4px)',
                          width: 'calc(50% - 12px)'
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                      
                      {/* Text Labels (Above Knob) */}
                      <div className="flex-1 relative z-20 flex items-center justify-center">
                        <span className={`text-xs md:text-sm font-black tracking-widest uppercase transition-colors duration-200 ${mode === 'SINGLE' ? 'text-[#4B9BFF]' : 'text-gray-500/70'}`}>
                          Single
                        </span>
                      </div>
                      <div className="flex-1 relative z-20 flex items-center justify-center">
                        <span className={`text-xs md:text-sm font-black tracking-widest uppercase transition-colors duration-200 ${mode === 'BATCH' ? 'text-[#4B9BFF]' : 'text-gray-500/70'}`}>
                          Batch
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="space-y-6 md:space-y-8">
                    {mode === 'SINGLE' ? (
                      <div className="space-y-4">
                         <div className="relative group">
                            {/* Deeply indented input */}
                            <div className={`neo-input-wrapper flex items-center p-2 ${error ? 'border-red-400/50 shadow-[inset_3px_3px_7px_#c5c5c5,inset_-3px_-3px_7px_#ffffff,0_0_0_1px_rgba(239,68,68,0.3)]' : ''}`}>
                              <div className={`pl-3 md:pl-4 ${error ? 'text-red-400' : 'text-gray-400'}`}>
                                 {platform !== Platform.UNKNOWN ? getPlatformIcon(platform, false) : <Search className="w-5 h-5 md:w-6 md:h-6 opacity-50" />}
                              </div>
                              <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onPaste={handlePaste}
                                disabled={appState === AppState.PROCESSING}
                                placeholder="Paste media link here..."
                                className={`
                                  w-full bg-transparent px-3 md:px-4 py-3 md:py-4
                                  focus:outline-none font-semibold text-base md:text-lg placeholder-gray-400/70
                                  disabled:opacity-50 ${error ? 'text-red-500' : 'text-[#666666]'}
                                `}
                              />
                              {url && !error && (
                                 <div className="pr-2 md:pr-4">
                                   <div className="w-2 h-2 rounded-full bg-[#4B9BFF] shadow-sm animate-pulse" />
                                 </div>
                              )}
                            </div>
                            
                            {/* Error Message for Single Mode - UPDATED STYLE */}
                            <AnimatePresence>
                              {error && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="neo-inset-error"
                                >
                                  <AlertCircle className="w-5 h-5 shrink-0 neo-icon-etched-error" />
                                  <span className="tracking-wide">{error}</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         <div 
                           className="relative"
                           onDragOver={handleDragOver}
                           onDragLeave={handleDragLeave}
                           onDrop={handleDrop}
                         >
                          <textarea
                            value={batchText}
                            onChange={(e) => setBatchText(e.target.value)}
                            onPaste={handlePaste}
                            disabled={appState === AppState.PROCESSING}
                            placeholder={isDragging ? "Drop .txt file here!" : `Paste multiple links...\nOne per line`}
                            className={`
                              w-full neo-input-wrapper text-[#666666] p-4 md:p-6 h-40 md:h-48
                              rounded-3xl focus:outline-none 
                              placeholder-gray-400/70 font-medium resize-none
                              disabled:opacity-50 text-sm md:text-base leading-relaxed
                              transition-all duration-200
                              ${error ? 'border border-red-200' : ''}
                              ${isDragging ? 'border-2 border-dashed border-[#4B9BFF] bg-blue-50/50 scale-[1.02]' : ''}
                            `}
                          />
                          
                          {/* Visual overlay for drag state */}
                          {isDragging && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                              <div className="bg-[#4B9BFF]/10 backdrop-blur-sm rounded-3xl inset-0 absolute" />
                              <div className="bg-white/80 px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 text-[#4B9BFF] font-bold animate-bounce">
                                <Upload className="w-6 h-6" />
                                <span>Drop text file</span>
                              </div>
                            </div>
                          )}

                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-4 right-4 md:bottom-6 md:right-6 p-2 md:p-3 neo-btn rounded-xl text-gray-400 hover:text-[#4B9BFF] transition-all z-20"
                            title="Upload .txt File"
                          >
                            <Upload className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                          <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
                        </div>
                         {error && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center text-red-500 text-xs font-bold"
                            >
                              {error}
                            </motion.div>
                         )}
                      </div>
                    )}

                    {/* Platform Icons */}
                    <div className="space-y-3">
                        <label className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest ml-4 block text-center">Supported Platforms</label>
                        <div className="flex flex-wrap justify-center gap-3 md:gap-6 py-2">
                           {[Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TIKTOK, Platform.TWITTER, Platform.YOUTUBE].map((p) => (
                             <div 
                               key={p} 
                               className={`
                                 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-300
                                 ${platform === p 
                                   ? 'neo-tab-active scale-110' 
                                   : 'neo-btn text-gray-400 hover:text-gray-600'}
                               `}
                             >
                               {getPlatformIcon(p, platform === p)}
                             </div>
                           ))}
                        </div>
                    </div>

                    {/* Format Selector - Tactile Pills */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-4 mb-2">
                          <label className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">Output Format</label>
                          {/* Advanced Settings Toggle */}
                          <button 
                             onClick={() => setShowSettings(!showSettings)}
                             className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${showSettings ? 'text-[#4B9BFF]' : 'text-gray-500 hover:text-gray-600'}`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            {showSettings ? 'Hide Options' : 'Options'}
                          </button>
                        </div>
                        
                        {/* MAIN CATEGORIES: VIDEO | AUDIO | IMG */}
                        <div className="grid grid-cols-3 gap-6 w-full relative z-10">
                          {(['VIDEO', 'AUDIO', 'IMG'] as const).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => {
                                setCategory(cat);
                                if (cat === 'VIDEO') setFormat(FileFormat.MP4);
                                else if (cat === 'AUDIO') setFormat(FileFormat.MP3);
                                else setFormat(FileFormat.JPEG); // Default for image
                              }}
                              disabled={appState === AppState.PROCESSING}
                              className={`
                                w-full py-3 md:py-4 rounded-2xl text-[10px] md:text-xs font-bold tracking-wider transition-all duration-300 
                                flex flex-col items-center justify-center gap-2
                                ${category === cat 
                                  ? 'neo-tab-active scale-[1.05]' 
                                  : 'neo-btn text-gray-500 hover:text-gray-700'}
                              `}
                            >
                              {getCategoryIcon(cat)}
                              <span>{cat === 'IMG' ? 'IMAGE' : cat}</span>
                            </button>
                          ))}
                        </div>

                        {/* ADVANCED SETTINGS PANEL */}
                        <AnimatePresence>
                          {showSettings && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-2 pb-2">
                                <div className="neo-pressed rounded-2xl p-4 md:p-5 flex flex-col gap-4">

                                  {/* VIDEO SETTINGS (MP4) */}
                                  {isVideo && (
                                    <>
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                          <Maximize2 className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />
                                          <span>Resolution</span>
                                        </div>
                                        <SegmentedControl 
                                          options={['720p', '1080p', '4k'] as VideoResolution[]}
                                          value={resolution}
                                          onChange={(val) => setResolution(val)}
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                            {muteAudio ? <VolumeX className="w-4 h-4 text-orange-400 neo-icon-etched" /> : <Volume2 className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />}
                                            <span>Mute Audio</span>
                                         </div>
                                         
                                         <div className="switch-toggle">
                                            <input 
                                              id="mute-switch"
                                              type="checkbox" 
                                              checked={muteAudio}
                                              onChange={(e) => setMuteAudio(e.target.checked)}
                                            />
                                            <label htmlFor="mute-switch"></label>
                                         </div>
                                      </div>
                                    </>
                                  )}

                                  {/* AUDIO SETTINGS (MP3) */}
                                  {isAudio && (
                                    <>
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                          <Music className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />
                                          <span>Bitrate</span>
                                        </div>
                                        <SegmentedControl 
                                          options={['128k', '192k', '320k'] as AudioBitrate[]}
                                          value={bitrate}
                                          onChange={(val) => setBitrate(val)}
                                        />
                                      </div>

                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                          <AudioLines className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />
                                          <span>Codec</span>
                                        </div>
                                        <SegmentedControl 
                                          options={['AAC', 'Opus', 'MP3'] as AudioCodec[]}
                                          value={audioCodec}
                                          onChange={(val) => setAudioCodec(val)}
                                        />
                                      </div>
                                    </>
                                  )}

                                  {/* IMAGE SETTINGS */}
                                  {isImage && (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                        <ImageIcon className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />
                                        <span>Format</span>
                                      </div>
                                      <div className="capitalize">
                                        <SegmentedControl 
                                          options={['JPEG', 'PNG', 'WEBP']}
                                          value={format as string}
                                          onChange={(val) => setFormat(val as FileFormat)}
                                        />
                                      </div>

                                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mt-4">
                                        <Image className="w-4 h-4 text-[#4B9BFF] neo-icon-etched" />
                                        <span>Quality Level</span>
                                      </div>
                                      <div className="capitalize">
                                        <SegmentedControl 
                                          options={['LOW', 'MEDIUM', 'HIGH'] as ImageQuality[]}
                                          value={imgQuality}
                                          onChange={(val) => setImgQuality(val)}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </div>
                  </div>

                  {/* Batch Processing List (Shows Errors) */}
                  {mode === 'BATCH' && (appState === AppState.PROCESSING || batchItems.length > 0) && (
                    <div className="max-h-56 overflow-y-auto neo-pressed rounded-2xl p-4 space-y-3 custom-scrollbar">
                      {batchItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 bg-white/40 rounded-xl border border-white/50 relative overflow-hidden">
                           {/* Status Icon */}
                           <div className="shrink-0 z-10">
                              {item.status === 'COMPLETED' && <CheckCircle className="w-5 h-5 text-[#4B9BFF]" />}
                              {item.status === 'PROCESSING' && <Loader2 className="w-5 h-5 text-[#4B9BFF] animate-spin" />}
                              {item.status === 'FAILED' && <AlertCircle className="w-5 h-5 text-red-500" />}
                              {item.status === 'PENDING' && <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-dashed" />}
                           </div>

                           <div className="flex-1 space-y-1.5 z-10 min-w-0">
                              <div className="flex justify-between items-center text-xs font-bold">
                                 <span className={`truncate ${item.status === 'FAILED' ? 'text-red-500' : 'text-gray-500'}`}>
                                   {item.url}
                                 </span>
                                 <span className={item.status === 'FAILED' ? 'text-red-500' : 'text-gray-400'}>
                                   {item.status === 'FAILED' ? (item.error || 'Failed') : `${Math.round(item.progress)}%`}
                                 </span>
                              </div>
                              {/* Progress Bar */}
                              <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 rounded-full ${item.status === 'FAILED' ? 'bg-red-400' : 'bg-[#4B9BFF] shadow-[0_0_10px_#4B9BFF]'}`} 
                                  style={{ width: `${item.progress}%` }} 
                                />
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Convert Action Button - The Luminescent Trigger */}
                  <div className="pt-4 md:pt-6">
                    <button
                      onClick={mode === 'SINGLE' ? handleConvert : handleBatchConvert}
                      disabled={(!url && !batchText) || appState === AppState.PROCESSING}
                      className={`
                        w-full h-16 md:h-20 rounded-3xl font-black text-base md:text-lg tracking-widest uppercase
                        transition-all duration-300 relative group overflow-hidden
                        ${(!url && !batchText) 
                           ? 'neo-btn-disabled' 
                           : appState === AppState.PROCESSING 
                             ? 'neo-pressed text-[#4B9BFF] border border-transparent'
                             : 'neo-primary-btn hover:-translate-y-1'
                        }
                      `}
                    >
                      <div className="relative z-10 flex items-center justify-center gap-3">
                         {appState === AppState.PROCESSING ? (
                           <>
                             <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                             <span>Processing...</span>
                           </>
                         ) : (
                           <>
                             <span>Convert Media</span>
                             <ChevronRight className="w-5 h-5 md:w-6 md:h-6 opacity-60 group-hover:translate-x-1 transition-transform" />
                           </>
                         )}
                      </div>
                      
                      {/* Internal Glow Animation for Processing (Single Mode) */}
                      {appState === AppState.PROCESSING && mode === 'SINGLE' && (
                        <motion.div 
                          className="absolute inset-0 bg-[#4B9BFF]/10 z-0"
                          initial={{ width: '0%' }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'tween', ease: 'linear' }}
                        />
                      )}
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          )}

          {/* SUCCESS STATE - DOWNLOAD CARD (Newly Added) */}
          {appState === AppState.SUCCESS && (
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="w-full max-w-lg"
            >
              <div className="neo-flat p-8 md:p-12 text-center relative overflow-hidden">
                 
                 {/* Success Icon */}
                 <div className="mx-auto w-24 h-24 rounded-full neo-pressed flex items-center justify-center mb-6 text-[#4B9BFF] relative">
                    <CheckCircle className="w-12 h-12" />
                    <div className="absolute inset-0 rounded-full border-4 border-[#4B9BFF]/20 animate-ping opacity-50" />
                 </div>

                 <h2 className="text-2xl font-black text-gray-800 mb-2">Conversion Complete</h2>
                 <p className="text-gray-500 mb-8 font-medium">Your media is ready for download.</p>

                 {/* Result Details (Single Mode) - UPDATED NEUMORPHIC STYLE */}
                 {mode === 'SINGLE' && singleResult && (
                   <div className="neo-inset-panel mb-8">
                      <p className="text-sm font-bold text-gray-700 break-all line-clamp-2 mb-1">{singleResult.filename}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{singleResult.fileSize}</p>
                   </div>
                 )}

                 {/* Result Details (Batch Mode Summary) - UPDATED NEUMORPHIC STYLE */}
                 {mode === 'BATCH' && (
                    <div className="neo-inset-panel mb-8">
                      <p className="text-sm font-bold text-gray-700">{completedItems.length} files converted successfully.</p>
                      {hasFailures && <p className="text-xs text-red-500 mt-1 font-bold">{failedItems.length} failed.</p>}
                    </div>
                 )}

                 {/* Action Buttons */}
                 <div className="space-y-4">
                    {mode === 'SINGLE' ? (
                       <button 
                          onClick={() => handleDownload(singleResult!)}
                          className="w-full h-16 rounded-2xl neo-primary-btn flex items-center justify-center gap-3 font-bold text-lg uppercase tracking-wider"
                       >
                          <Download className="w-6 h-6" />
                          Download File
                       </button>
                    ) : (
                       <button 
                          onClick={handleBatchDownload}
                          className="w-full h-16 rounded-2xl neo-primary-btn flex items-center justify-center gap-3 font-bold text-lg uppercase tracking-wider"
                       >
                          <Download className="w-6 h-6" />
                          Download All
                       </button>
                    )}

                    <button 
                      onClick={reset}
                      className="w-full py-4 rounded-xl neo-btn text-gray-500 font-bold hover:text-[#4B9BFF] flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Convert Another
                    </button>
                 </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  );
};

export default Converter;