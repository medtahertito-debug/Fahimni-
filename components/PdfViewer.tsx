import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X, RotateCw, Loader2 } from 'lucide-react';

// Set up the worker from a CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  title: string;
  onClose: () => void;
  language: 'ar' | 'fr' | 'en';
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, title, onClose, language }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      const viewer = document.getElementById('pdf-viewer-container');
      if (viewer) {
        const width = viewer.clientWidth - 40;
        setContainerWidth(width);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadProgress = ({ loaded, total }: { loaded: number, total: number }) => {
    setLoadProgress(Math.round((loaded / total) * 100));
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const next = prevPageNumber + offset;
      if (next < 1) return 1;
      if (numPages && next > numPages) return numPages;
      return next;
    });
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const fitToWidth = () => setScale(1.0);
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRtl = language === 'ar';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800 shadow-xl">
        <div className="flex items-center gap-4 overflow-hidden">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <h2 className="font-bold text-lg truncate max-w-[200px] sm:max-w-md">{title}</h2>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-1">
            <button onClick={zoomOut} className="p-2 hover:bg-slate-700 rounded-md transition-colors" title="Zoom Out">
              <ZoomOut size={20} />
            </button>
            <button onClick={fitToWidth} className="px-2 text-sm font-bold hover:bg-slate-700 rounded-md transition-colors h-9" title="Fit to Width">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={zoomIn} className="p-2 hover:bg-slate-700 rounded-md transition-colors" title="Zoom In">
              <ZoomIn size={20} />
            </button>
          </div>
          
          <button 
            onClick={handleDownload} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            title="Download"
          >
            <Download size={20} />
          </button>
          
          <button 
            onClick={rotate} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            title="Rotate"
          >
            <RotateCw size={20} />
          </button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div id="pdf-viewer-container" className="flex-1 overflow-auto bg-slate-800 flex justify-center p-4 relative scrollbar-hide">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900 z-10">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="text-lg font-medium animate-pulse">
              {isRtl ? 'جاري تحميل الملف...' : 'Loading document...'}
            </p>
            {loadProgress > 0 && (
              <div className="mt-4 w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ width: `${loadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        )}
        
        <div className="shadow-2xl h-fit">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadProgress={onDocumentLoadProgress}
            loading={null}
            error={
              <div className="text-white p-10 text-center">
                <p className="mb-4 text-red-400 font-bold">
                  {isRtl ? 'فشل تحميل الملف' : 'Failed to load document'}
                </p>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl inline-block"
                >
                  {isRtl ? 'فتح في المتصفح' : 'Open in browser'}
                </a>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              width={containerWidth || undefined}
              rotate={rotation}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="max-w-full"
            />
          </Document>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-900 text-white p-4 flex justify-center items-center gap-6 border-t border-slate-800">
        <div className="flex items-center gap-4 bg-slate-800 rounded-2xl px-4 py-2 shadow-inner">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => changePage(-1)}
            className={`p-2 rounded-full transition-colors ${pageNumber <= 1 ? 'text-slate-600' : 'hover:bg-slate-700 text-white'}`}
          >
            {isRtl ? <ChevronRight size={28} /> : <ChevronLeft size={28} />}
          </button>
          
          <div className="flex items-center gap-2 font-bold min-w-[80px] justify-center">
            <span className="text-blue-400 text-lg">{pageNumber}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{numPages || '--'}</span>
          </div>
          
          <button 
            disabled={numPages === null || pageNumber >= numPages}
            onClick={() => changePage(1)}
            className={`p-2 rounded-full transition-colors ${numPages === null || pageNumber >= numPages ? 'text-slate-600' : 'hover:bg-slate-700 text-white'}`}
          >
            {isRtl ? <ChevronLeft size={28} /> : <ChevronRight size={28} />}
          </button>
        </div>

        {/* Mobile Zoom Controls */}
        <div className="flex sm:hidden items-center bg-slate-800 rounded-2xl p-1">
          <button onClick={zoomOut} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ZoomOut size={20} />
          </button>
          <button onClick={fitToWidth} className="px-2 text-xs font-bold">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ZoomIn size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
