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

  console.log('📚 ProductHistory render:', { products: products.length, isHost });

  if (!products || products.length === 0) {
    console.log('📚 ProductHistory rendering empty state');
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Product History</h3>
          <div className="flex items-center space-x-2">
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
              0
            </span>
            {isHost && (
              <>
                <button
                  onClick={onExport}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Export History"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={onClear}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear History"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">No products yet</p>
          <p className="text-xs text-gray-400 mt-1">Products will appear here as they're described</p>
        </div>
      </div>
    );
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
