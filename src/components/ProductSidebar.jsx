import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Eye } from 'lucide-react';
import { formatProductForDisplay } from '../utils/product-sync';
import { getProductThemeConfig } from '../services/config';

/**
 * ProductSidebar - History of pinned products
 * @param {Object} props
 * @param {Array} props.productHistory - Array of pinned products
 * @param {Function} props.onSelectProduct - Callback when product is selected
 * @param {Function} props.onRemoveProduct - Callback when product is removed
 * @param {boolean} props.isVisible - Whether sidebar is visible
 * @param {string} props.className - Additional CSS classes
 */
export default function ProductSidebar({
  productHistory = [],
  onSelectProduct,
  onRemoveProduct,
  isVisible = true,
  className = ''
}) {
  if (!isVisible || productHistory.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock size={18} />
          Product History
        </h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {productHistory.length}
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {productHistory.map((product, index) => {
            const formattedProduct = formatProductForDisplay(product);
            const themeConfig = getProductThemeConfig(product.theme);
            
            if (!formattedProduct.hasContent) {
              return null;
            }

            return (
              <motion.div
                key={`${product.product_name || 'product'}_${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all ${themeConfig.borderColor} ${themeConfig.bgColor}`}
                onClick={() => onSelectProduct && onSelectProduct(product)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {formattedProduct.category && (
                      <div className={`text-xs ${themeConfig.textColor} opacity-75 mb-1`}>
                        {formattedProduct.category}
                      </div>
                    )}
                    
                    {formattedProduct.primary && (
                      <div className={`text-sm font-medium ${themeConfig.textColor} mb-1 truncate`}>
                        {formattedProduct.primary}
                      </div>
                    )}
                    
                    {formattedProduct.shortCopy && (
                      <div className={`text-xs ${themeConfig.textColor} opacity-90 line-clamp-2`}>
                        {formattedProduct.shortCopy}
                      </div>
                    )}
                    
                    {product.price_estimate && (
                      <div className={`text-xs font-medium ${themeConfig.textColor} mt-2`}>
                        {product.price_estimate}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct && onSelectProduct(product);
                      }}
                      className={`p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${themeConfig.textColor} opacity-60 hover:opacity-100`}
                      aria-label="View product"
                    >
                      <Eye size={14} />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveProduct && onRemoveProduct(product, index);
                      }}
                      className={`p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors ${themeConfig.textColor} opacity-60 hover:opacity-100`}
                      aria-label="Remove product"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                
                {/* Theme accent */}
                <div className={`mt-2 h-0.5 rounded-full ${themeConfig.accentColor} opacity-40`} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {productHistory.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No products pinned yet</p>
          <p className="text-xs opacity-75">Pin products during your stream to see them here</p>
        </div>
      )}
    </motion.div>
  );
}
