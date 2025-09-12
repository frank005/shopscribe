import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import agoraService from '../services/agoraService';

export default function DeviceSettings({ isOpen, onClose, onDeviceChange }) {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load available devices
  const loadDevices = async () => {
    setIsRefreshing(true);
    try {
      const [cameraList, microphoneList] = await Promise.all([
        agoraService.getCameras(),
        agoraService.getMicrophones()
      ]);
      
      setCameras(cameraList);
      setMicrophones(microphoneList);
      
      // Set default selections if none are selected
      if (!selectedCamera && cameraList.length > 0) {
        setSelectedCamera(cameraList[0].deviceId);
      }
      if (!selectedMicrophone && microphoneList.length > 0) {
        setSelectedMicrophone(microphoneList[0].deviceId);
      }
      
      console.log('📹 Available cameras:', cameraList);
      console.log('🎤 Available microphones:', microphoneList);
    } catch (error) {
      console.error('❌ Error loading devices:', error);
      toast.error('Failed to load device list');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load devices when component mounts or when opened
  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  // Handle camera change
  const handleCameraChange = async (deviceId) => {
    if (!deviceId) return;
    
    setIsLoading(true);
    try {
      setSelectedCamera(deviceId);
      
      // If we have an existing video track, use setDevice to switch
      if (agoraService.localVideoTrack) {
        await agoraService.localVideoTrack.setDevice(deviceId);
        toast.success('Camera changed successfully');
        
        // Notify parent component
        if (onDeviceChange) {
          onDeviceChange('camera', deviceId);
        }
      } else {
        toast.info('Camera will be applied when video is enabled');
      }
    } catch (error) {
      console.error('❌ Error changing camera:', error);
      toast.error('Failed to change camera');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle microphone change
  const handleMicrophoneChange = async (deviceId) => {
    if (!deviceId) return;
    
    setIsLoading(true);
    try {
      setSelectedMicrophone(deviceId);
      
      // If we have an existing audio track, use setDevice to switch
      if (agoraService.localAudioTrack) {
        await agoraService.localAudioTrack.setDevice(deviceId);
        toast.success('Microphone changed successfully');
        
        // Notify parent component
        if (onDeviceChange) {
          onDeviceChange('microphone', deviceId);
        }
      } else {
        toast.info('Microphone will be applied when audio is enabled');
      }
    } catch (error) {
      console.error('❌ Error changing microphone:', error);
      toast.error('Failed to change microphone');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh devices
  const handleRefreshDevices = async () => {
    await loadDevices();
    toast.success('Device list refreshed');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Device Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Camera Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Camera</label>
              <button
                onClick={handleRefreshDevices}
                disabled={isRefreshing}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <select
              value={selectedCamera}
              onChange={(e) => handleCameraChange(e.target.value)}
              disabled={isLoading || cameras.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cameras.length === 0 ? (
                <option value="">No cameras found</option>
              ) : (
                cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                  </option>
                ))
              )}
            </select>
            {cameras.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                No cameras detected. Make sure your camera is connected and not being used by another application.
              </p>
            )}
          </div>

          {/* Microphone Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">Microphone</label>
            <select
              value={selectedMicrophone}
              onChange={(e) => handleMicrophoneChange(e.target.value)}
              disabled={isLoading || microphones.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {microphones.length === 0 ? (
                <option value="">No microphones found</option>
              ) : (
                microphones.map((microphone) => (
                  <option key={microphone.deviceId} value={microphone.deviceId}>
                    {microphone.label || `Microphone ${microphone.deviceId.slice(0, 8)}`}
                  </option>
                ))
              )}
            </select>
            {microphones.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                No microphones detected. Make sure your microphone is connected and not being used by another application.
              </p>
            )}
          </div>

          {/* Device Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Device Information</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Cameras:</strong> {cameras.length} detected</p>
              <p><strong>Microphones:</strong> {microphones.length} detected</p>
              {isLoading && (
                <p className="text-blue-600">Switching device...</p>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Tips</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Device changes take effect immediately without reconnecting</p>
              <p>• Make sure devices aren't being used by other applications</p>
              <p>• Click "Refresh" if you connect new devices</p>
              <p>• Changes are applied to your current stream seamlessly</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
