import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';

// Configure pdfjs worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.error('Failed to set pdfjs workerSrc', e);
}

interface PdfRendererProps {
  dataUrl?: string;
  blobUrl?: string;
  language: 'en' | 'zh';
}

export const PdfRenderer: React.FC<PdfRendererProps> = ({ dataUrl, blobUrl, language }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isZh = language === 'zh';

  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        let pdfData: Uint8Array | null = null;

        if (blobUrl) {
          const res = await fetch(blobUrl);
          const arrayBuffer = await res.arrayBuffer();
          pdfData = new Uint8Array(arrayBuffer);
        } else if (dataUrl) {
          // Extract base64
          const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          const binaryString = atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfData = bytes;
        }

        if (!pdfData) {
          throw new Error('No PDF data available');
        }

        const loadingTask = pdfjsLib.getDocument({
          data: pdfData,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;

        if (isCancelled) return;

        setNumPages(pdf.numPages);

        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        // Render each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (isCancelled) return;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'w-full flex flex-col items-center mb-4 bg-white shadow-2xs rounded-lg overflow-hidden';

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';

          pageWrapper.appendChild(canvas);

          if (pdf.numPages > 1) {
            const pageBadge = document.createElement('div');
            pageBadge.className = 'text-center py-1 text-xs text-slate-400 font-medium bg-slate-50 w-full border-t border-slate-100';
            pageBadge.textContent = `${isZh ? '第' : 'Page'} ${pageNum} / ${pdf.numPages} ${isZh ? '页' : ''}`;
            pageWrapper.appendChild(pageBadge);
          }

          if (containerRef.current) {
            containerRef.current.appendChild(pageWrapper);
          }

          const renderContext: any = {
            canvasContext: context!,
            viewport: viewport,
            canvas: canvas,
          };

          await page.render(renderContext).promise;
        }

        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PDF render error:', err);
        if (!isCancelled) {
          setError(
            isZh
              ? '无法在屏幕上直接预览该 PDF。但 AI 仍能正常读取并解读该文件。'
              : 'Unable to render PDF preview. The AI can still analyze it.'
          );
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [dataUrl, blobUrl, language]);

  return (
    <div className="w-full h-full relative overflow-y-auto p-2 bg-slate-50 rounded-[12px] flex flex-col items-center">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 rounded-[12px] space-y-3">
          <Loader2 className="w-8 h-8 text-[#2B7FD4] animate-spin" />
          <p className="text-sm font-semibold text-[#1E293B]">
            {isZh ? '正在解析 PDF 页面...' : 'Loading PDF pages...'}
          </p>
        </div>
      )}

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-600 max-w-[280px]">{error}</p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full max-w-full" />
      )}
    </div>
  );
};
