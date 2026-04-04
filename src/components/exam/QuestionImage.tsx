import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function QuestionImage({ src, alt, className }: QuestionImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className={cn('flex justify-center', className)}>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative group cursor-zoom-in rounded-xl overflow-hidden border-2 border-border/40 bg-muted/30 p-2 shadow-sm w-fit max-w-full transition-colors hover:border-border/60"
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[320px] object-contain mx-auto"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
            <ZoomIn className="h-5 w-5 text-foreground/0 group-hover:text-foreground/50 transition-colors" />
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
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10"
              aria-label="Fechar imagem"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
