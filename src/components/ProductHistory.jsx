import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Download, Trash2 } from 'lucide-react';
import { formatProductForDisplay } from '../utils/product-sync';
import { getProductThemeConfig } from '../services/config';

/**
 * ProductHistory - Component for displaying and managing product history
 * @param {Object} props
 * @param {Array} props.products - Array of product objects
 * @param {Function} props.onCopy - Callback for copying product (host only)
 * @param {Function} props.onExport - Callback for exporting all products (host only)
 * @param {Function} props.onClear - Callback for clearing history (host only)
 * @param {boolean} props.isHost - Whether current user is host
 * @param {string} props.className - Additional CSS classes
 */
export default function ProductHistory({ 
  products = [], 
  onCopy,
  onExport,
  onClear,
  isHost = false,
  className = '' 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  if (!products || products.length === 0) {
    return null;
  }

  const handleCopy = (product) => {
    if (onCopy) {
      onCopy(product);
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport(products);
    }
  };

  const handleClear = () => {
    if (onClear && window.confirm('Clear all product history?')) {
      onClear();
    }
  };

  const toggleItemExpansion = (index) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Product History</h3>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
            {products.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isHost && (
            <>
              {onExport && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport();
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Export all products"
                >
                  <Download size={16} />
                </button>
              )}
              
              {onClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                  title="Clear history"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}
          
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
              {products.map((product, index) => {
                const formattedProduct = formatProductForDisplay(product);
                const themeConfig = getProductThemeConfig(product.theme);
                const isItemExpanded = expandedItems.has(index);

                if (!formattedProduct.hasContent) {
                  return null;
                }

                return (
                  <div key={index} className="border-b border-gray-100 last:border-b-0">
                    <div 
                      className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleItemExpansion(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                            {formattedProduct.category && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {formattedProduct.category}
                              </span>
                            )}
                          </div>
                          
                          {formattedProduct.primary && (
                            <div className="text-sm font-medium text-gray-900 mt-1 truncate">
                              {formattedProduct.primary}
                            </div>
                          )}
                          
                          {formattedProduct.shortCopy && (
                            <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {formattedProduct.shortCopy}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 ml-2">
                          {isHost && onCopy && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(product);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Copy product"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                          
                          {isItemExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isItemExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 bg-gray-50">
                            {formattedProduct.details.length > 0 && (
                              <div className="space-y-1">
                                {formattedProduct.details.map((detail, detailIndex) => (
                                  <div key={detailIndex} className="text-xs text-gray-700">
                                    <span className="font-medium">{detail.label}:</span>{' '}
                                    <span>{detail.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {formattedProduct.price_estimate && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-sm font-semibold text-green-600">
                                  {formattedProduct.price_estimate}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
