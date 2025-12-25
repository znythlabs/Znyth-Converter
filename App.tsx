import React, { useState } from 'react';
import Scene from './components/Scene';
import Converter from './components/Converter';
import { AppState } from './types';
import { Zap, UserCircle, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="relative w-full min-h-screen bg-[#e8e8e8] text-gray-700 selection:bg-[#4B9BFF]/20 selection:text-[#4B9BFF]">
      
      {/* 
        GLOBAL TEXTURE OVERLAY 
        Fixed position ensures it covers the screen even when scrolling
      */}
      <div className="fixed inset-0 z-[100] pointer-events-none opacity-[0.2] mix-blend-overlay grayscale bg-noise" />

      {/* Foreground UI Layer - Natural Document Flow */}
      <main className="relative z-10 w-full min-h-screen flex flex-col">
        
        {/* Neomorphic Navbar - Non-sticky (scrolls with page) */}
        <header className="px-5 py-4 md:px-10 md:py-6 flex justify-between items-center z-50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-[#e8e8e8] shadow-[6px_6px_12px_#c5c5c5,-6px_-6px_12px_#ffffff] flex items-center justify-center text-[#4B9BFF]">
               <Zap className="w-5 h-5 fill-current" />
             </div>
             {/* Text Hidden on Mobile to reduce header visual weight */}
             <span className="hidden md:block text-lg md:text-xl font-bold tracking-tight text-gray-800">
               Znyth<span className="text-[#4B9BFF]">Converter</span>
             </span>
           </div>
           
           {/* Desktop Nav */}
           <nav className="hidden md:flex items-center gap-6">
             {['Features', 'Pricing', 'About'].map(item => (
               <a key={item} href="#" className="text-sm font-semibold text-gray-500 hover:text-[#4B9BFF] transition-colors">
                 {item}
               </a>
             ))}
             <button className="p-2 rounded-full bg-[#e8e8e8] shadow-[6px_6px_12px_#c5c5c5,-6px_-6px_12px_#ffffff] hover:shadow-[inset_4px_4px_12px_#c5c5c5,inset_-4px_-4px_12px_#ffffff] transition-shadow text-gray-600">
               <UserCircle className="w-5 h-5" />
             </button>
           </nav>

           {/* Mobile Controls (Profile + Hamburger) */}
           <div className="flex md:hidden items-center gap-3">
              <button className="p-2 rounded-full neo-btn text-gray-600 hover:text-[#4B9BFF] transition-colors">
                 <UserCircle className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-full neo-btn text-gray-600 hover:text-[#4B9BFF] transition-colors"
              >
                 <AnimatePresence mode="wait">
                    {isMobileMenuOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <X className="w-6 h-6" />
                        </motion.div>
                    ) : (
                        <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <Menu className="w-6 h-6" />
                        </motion.div>
                    )}
                 </AnimatePresence>
              </button>
           </div>
        </header>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="absolute top-20 right-5 z-50 w-56 neo-flat bg-noise rounded-2xl p-3 flex flex-col md:hidden shadow-2xl"
            >
              {['Features', 'Pricing', 'About'].map(item => (
                <a 
                  key={item} 
                  href="#" 
                  className="p-3 rounded-xl hover:bg-black/5 text-base font-bold text-gray-600 hover:text-[#4B9BFF] transition-colors text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area - Grows to fill space */}
        <div className="flex-1 w-full flex flex-col">
          <Converter appState={appState} setAppState={setAppState} />
        </div>

        {/* Footer info - Non-sticky (at the bottom of content) */}
        <footer className="w-full py-8 text-center bg-transparent text-[10px] text-gray-700 font-medium tracking-[0.2em] pointer-events-none opacity-60">
          ZNYTH CONVERTER • POWERED BY ZNYTH LABS
        </footer>
      </main>
    </div>
  );
};

export default App;