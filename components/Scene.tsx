import React from 'react';
import { SceneProps, AppState } from '../types';
import { motion } from 'framer-motion';

const Scene: React.FC<SceneProps> = ({ appState }) => {
  // Determine dynamic colors based on state
  const getAmbientColor = () => {
    switch(appState) {
      case AppState.PROCESSING: return 'radial-gradient(circle, rgba(75, 155, 255, 0.4) 0%, rgba(209, 217, 230, 0) 70%)'; // Blue pulse
      case AppState.SUCCESS: return 'radial-gradient(circle, rgba(72, 187, 120, 0.3) 0%, rgba(209, 217, 230, 0) 70%)'; // Green tint
      default: return 'radial-gradient(circle, #D1D9E6 0%, rgba(209, 217, 230, 0) 70%)'; // Neutral warm
    }
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#E8E8E8] pointer-events-none transition-colors duration-1000">
      
      {/* 2. Fine Grain Texture - Uses the global CSS class now */}
      <div 
        className="absolute inset-0 opacity-[0.1] mix-blend-multiply grayscale bg-noise"
      />

      {/* 3. Subtle Ambient Warmth (Bottom Right) */}
      {/* We use framer-motion here to smoothly animate the background gradient change */}
      <motion.div 
        className="absolute bottom-[-20%] right-[-10%] w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-30"
        animate={{ background: getAmbientColor() }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      
      {/* 4. Secondary Light Source (Top Left) - Adds depth during processing */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px]"
        initial={{ opacity: 0 }}
        animate={{ 
           opacity: appState === AppState.PROCESSING ? 0.4 : 0,
           background: 'radial-gradient(circle, rgba(75, 155, 255, 0.3) 0%, rgba(255, 255, 255, 0) 70%)'
        }}
        transition={{ duration: 1 }}
      />
    </div>
  );
};

export default Scene;