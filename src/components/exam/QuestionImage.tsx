import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionImageProps {
  src: string;
  alt: string;
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function QuestionImage({ src, alt, className }: QuestionImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Pan / pinch tracking
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const didInteract = useRef(false);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    resetZoom();
  }, [resetZoom]);

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => {
      const next = clamp(prev + delta, MIN_SCALE, MAX_SCALE);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Esc closes; +/- zoom
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === '+' || e.key === '=') zoomBy(0.5);
      else if (e.key === '-' || e.key === '_') zoomBy(-0.5);
      else if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, closeLightbox, zoomBy, resetZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    setScale((prev) => {
      const next = clamp(prev + delta, MIN_SCALE, MAX_SCALE);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    didInteract.current = false;
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, scale };
      dragStart.current = null;
    } else if (scale > 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  }, [scale, offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchStart.current && pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const next = clamp(pinchStart.current.scale * (dist / pinchStart.current.dist), MIN_SCALE, MAX_SCALE);
      didInteract.current = true;
      setScale(next);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return;
    }

    if (dragStart.current && scale > 1) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didInteract.current = true;
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    }
  }, [scale]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale((prev) => {
      if (prev > 1) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  return (
    <>
      <div className={cn('flex justify-center', className)}>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative group cursor-zoom-in rounded-xl overflow-hidden border-2 border-border/40 bg-white p-2 shadow-sm w-fit max-w-full transition-colors hover:border-border/60"
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[320px] object-contain mx-auto"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
            <ZoomIn className="h-5 w-5 text-black/0 group-hover:text-black/40 transition-colors" />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-foreground/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => closeLightbox()}
          >
            {/* Toolbar */}
            <div
              className="absolute top-4 right-4 z-10 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => zoomBy(-0.5)}
                disabled={scale <= MIN_SCALE}
                className="h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(0.5)}
                disabled={scale >= MAX_SCALE}
                className="h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
                className="h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Resetar zoom"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => closeLightbox()}
                className="h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                aria-label="Fechar imagem"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scale indicator */}
            {scale > 1 && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/90 px-3 py-1 text-sm font-medium text-foreground shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                {Math.round(scale * 100)}%
              </div>
            )}

            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              src={src}
              alt={alt}
              draggable={false}
              className={cn(
                'max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none touch-none',
                scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
              )}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transition: dragStart.current || pinchStart.current ? 'none' : 'transform 0.15s ease-out',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (didInteract.current) return;
                if (scale === 1) zoomBy(1);
              }}
              onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(); }}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
