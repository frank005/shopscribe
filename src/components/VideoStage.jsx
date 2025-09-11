import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * VideoStage - Container for video display with overlay mounting point
 * @param {Object} props
 * @param {React.ReactNode} props.children - Overlay components to render
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.videoProps - Props to pass to video element
 * @param {boolean} props.showLoading - Whether to show loading overlay
 */
export default function VideoStage({ 
  children, 
  className = '', 
  videoProps = {},
  showLoading = true,
  mode = 'both' // 'local', 'remote', or 'both'
}) {
  // const videoRef = useRef(null);

  useEffect(() => {
    // Video element setup can be handled here if needed
    // For now, we'll let Agora handle the video element directly
  }, []);

  return (
    <div className={`relative w-full h-full bg-black rounded-xl overflow-hidden ${className}`}>
      {/* Local video container for host */}
      {(mode === 'local' || mode === 'both') && (
        <div 
          id="local-player"
          className="absolute inset-0 w-full h-full"
          {...videoProps}
        />
      )}
      
      {/* Remote video container for audience */}
      {(mode === 'remote' || mode === 'both') && (
        <div 
          id="remote-player"
          className="absolute inset-0 w-full h-full z-10"
          {...videoProps}
        />
      )}
      
      {/* Overlay mounting point */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {children}
      </div>
      
      {/* Loading state - only show when showLoading is true */}
      {showLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50"
        >
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
            <p className="text-sm">Connecting to stream...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
