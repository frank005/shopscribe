import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Copy, Download, Eye, EyeOff } from 'lucide-react';
import { formatProductForDisplay } from '../utils/product-sync';
import { getProductThemeConfig } from '../services/config';

/**
 * ProductOverlay - Floating overlay that displays product information
 * @param {Object} props
 * @param {Object} props.product - Product object to display
 * @param {boolean} props.visible - Whether overlay is visible
 * @param {Function} props.onClose - Callback when overlay is closed
 * @param {Function} props.onNext - Callback for next product (host only)
 * @param {Function} props.onCopy - Callback for copying product (host only)
 * @param {Function} props.onExport - Callback for exporting history (host only)
 * @param {boolean} props.isHost - Whether current user is host
 * @param {string} props.className - Additional CSS classes
 */
export default function ProductOverlay({ 
  product, 
  visible, 
  onClose, 
  onNext,
  onCopy,
  onExport,
  isHost = false,
  className = '' 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!product || !visible) {
    return null;
  }

  const formattedProduct = formatProductForDisplay(product);
  const themeConfig = getProductThemeConfig(product.theme);
  
  if (!formattedProduct.hasContent) {
    return null;
  }

  const handleCopy = () => {
    if (onCopy) {
      onCopy(product);
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-start p-3 sm:p-4 ${className}`}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={`pointer-events-auto max-w-md rounded-2xl shadow-xl ring-1 ring-black/5 backdrop-blur p-4 ${themeConfig.bgColor} ${themeConfig.borderColor} border`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {formattedProduct.category && (
                <div className={`text-sm ${themeConfig.textColor} opacity-75 mb-1`}>
                  {formattedProduct.category}
                </div>
              )}
              
              {formattedProduct.primary && (
                <div className={`text-lg font-semibold ${themeConfig.textColor} mb-2`}>
                  {formattedProduct.primary}
                </div>
              )}
              
              {formattedProduct.shortCopy && (
                <div className={`text-sm ${themeConfig.textColor} opacity-90 leading-relaxed`}>
                  {formattedProduct.shortCopy}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {isHost && (
                <>
                  {onCopy && (
                    <button
                      onClick={handleCopy}
                      className={`rounded-xl border px-2 py-1 text-xs hover:opacity-80 transition-opacity ${themeConfig.borderColor} ${themeConfig.textColor}`}
                      aria-label="Copy product info"
                      title="Copy product info"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                  
                  {onExport && (
                    <button
                      onClick={handleExport}
                      className={`rounded-xl border px-2 py-1 text-xs hover:opacity-80 transition-opacity ${themeConfig.borderColor} ${themeConfig.textColor}`}
                      aria-label="Export product history"
                      title="Export product history"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  
                  {onNext && (
                    <button
                      onClick={handleNext}
                      className={`rounded-xl border px-2 py-1 text-xs hover:opacity-80 transition-opacity ${themeConfig.borderColor} ${themeConfig.textColor}`}
                      aria-label="Next product"
                      title="Next product"
                    >
                      Next
                    </button>
                  )}
                </>
              )}
              
              {onClose && (
                <button
                  onClick={onClose}
                  className={`ml-1 rounded-xl border px-2 py-1 text-xs hover:opacity-80 transition-opacity ${themeConfig.borderColor} ${themeConfig.textColor}`}
                  aria-label="Hide product overlay"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {formattedProduct.details.length > 0 && (
            <details 
              className="mt-3"
              open={isExpanded}
              onToggle={(e) => setIsExpanded(e.target.open)}
            >
              <summary className={`cursor-pointer text-sm ${themeConfig.textColor} opacity-75 hover:opacity-100 transition-opacity flex items-center gap-1`}>
                <span>Details</span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </summary>
              
              <div className="mt-2 space-y-1">
                {formattedProduct.details.map((detail, index) => (
                  <div key={index} className={`text-sm ${themeConfig.textColor} opacity-90`}>
                    <span className="font-medium">{detail.label}:</span>{' '}
                    <span>{detail.value}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          
          {/* Theme accent bar */}
          <div className={`mt-3 h-1 rounded-full ${themeConfig.accentColor} opacity-60`} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
