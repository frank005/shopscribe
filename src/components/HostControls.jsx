import React from 'react';
import { Eye, EyeOff, SkipForward, Pin, Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';

/**
 * HostControls - Control panel for host functionality
 * @param {Object} props
 * @param {Object} props.currentProduct - Current product object
 * @param {boolean} props.overlayVisible - Whether overlay is visible
 * @param {boolean} props.microphoneEnabled - Whether microphone is enabled
 * @param {boolean} props.videoEnabled - Whether video is enabled
 * @param {Function} props.onToggleOverlay - Toggle overlay visibility
 * @param {Function} props.onNextProduct - Move to next product
 * @param {Function} props.onPinProduct - Pin current product to history
 * @param {Function} props.onToggleMicrophone - Toggle microphone
 * @param {Function} props.onToggleVideo - Toggle video
 * @param {Function} props.onOpenDeviceSettings - Open device settings modal
 * @param {string} props.className - Additional CSS classes
 */
export default function HostControls({
  currentProduct,
  overlayVisible,
  microphoneEnabled,
  videoEnabled,
  onToggleOverlay,
  onNextProduct,
  onPinProduct,
  onToggleMicrophone,
  onToggleVideo,
  onOpenDeviceSettings,
  className = ''
}) {
  const hasProduct = currentProduct && Object.keys(currentProduct).length > 0;
  const productName = currentProduct?.product_name || currentProduct?.short_copy || 'No product';

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Media Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMicrophone}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
              microphoneEnabled 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {microphoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            <span className="text-sm">Mic</span>
          </button>
          
          <button
            onClick={onToggleVideo}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
              videoEnabled 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label={videoEnabled ? 'Turn off video' : 'Turn on video'}
          >
            {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
            <span className="text-sm">Video</span>
          </button>
          
          <button
            onClick={onOpenDeviceSettings}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            aria-label="Open device settings"
          >
            <Settings size={16} />
            <span className="text-sm">Devices</span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Product Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOverlay}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
              overlayVisible 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            disabled={!hasProduct}
            aria-label={overlayVisible ? 'Hide overlay' : 'Show overlay'}
          >
            {overlayVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="text-sm">{overlayVisible ? 'Hide' : 'Show'}</span>
          </button>
          
          <button
            onClick={onNextProduct}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
            aria-label="Next product"
          >
            <SkipForward size={16} />
            <span className="text-sm">Next</span>
          </button>
          
          <button
            onClick={onPinProduct}
            disabled={!hasProduct}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
              hasProduct 
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            aria-label="Pin product to history"
          >
            <Pin size={16} />
            <span className="text-sm">Pin</span>
          </button>
        </div>

        {/* Current Product Status */}
        {hasProduct && (
          <>
            <div className="w-px h-8 bg-gray-300" />
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-medium">Current:</span>
              <span className="truncate max-w-32" title={productName}>
                {productName}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
