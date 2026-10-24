

import { ReactNode, useState, useRef, useCallback } from 'react';
import { Check, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import ModalOverlay from '../ui/ModalOverlay';
import Loader from '../ui/Loader';
import { DetailModalHeader, DetailModalBody } from '../ui/DetailModal';

export type StepDefinition = {
  title: string;
  icon?: ReactNode;
  description?: string;
};

type MultiStepFormProps = {
  title: string;
  subtitle?: string;
  steps: StepDefinition[];
  onClose: () => void;
  onSubmit: () => Promise<void>;
  loading?: boolean;
  error?: string;
  children: ReactNode[];
  icon?: ReactNode;
  maxWidth?: string;
};

export default function MultiStepForm({
  title,
  subtitle,
  steps,
  onClose,
  onSubmit,
  loading = false,
  error,
  children,
  icon,
  maxWidth = 'max-w-full sm:max-w-[1000px]',
}: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const validateStep = useCallback((stepIndex: number): boolean => {
    const step = children[stepIndex];
    if (!step) return true;

    const stepEl = document.querySelector(`[data-step="${stepIndex}"]`);
    if (!stepEl) return true;

    const requiredFields = stepEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input[required], select[required], textarea[required]'
    );
    const emptyRequired = Array.from(requiredFields).filter(f => !f.value.trim());

    if (emptyRequired.length > 0) {
      const fieldNames = emptyRequired.map(f => {
        const label = f.closest('[data-label]')?.getAttribute('data-label') || f.name || 'Campo requerido';
        return label;
      });
      setStepErrors(prev => ({ ...prev, [stepIndex]: `Completa los campos: ${fieldNames.join(', ')}` }));
      emptyRequired[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      emptyRequired[0].focus();
      return false;
    }

    setStepErrors(prev => {
      const next = { ...prev };
      delete next[stepIndex];
      return next;
    });
    return true;
  }, [children]);

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
      <div
        className={`bg-white w-full max-h-[85dvh] sm:max-h-[90vh] ${maxWidth} rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <DetailModalHeader>
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pr-1">
            {icon && (
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 flex items-center justify-center text-white">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">{title}</h2>
              {subtitle && (
                <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                  <span className="line-clamp-2 sm:truncate">{subtitle}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
            disabled={loading}
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </DetailModalHeader>

        {/* Step indicators */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-6 py-2 sm:py-3 shrink-0">
          <div className="flex items-center justify-center gap-0">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => { if (i < currentStep || validateStep(currentStep)) setCurrentStep(i); }}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-[8px] sm:text-[10px] font-normal uppercase tracking-wide transition-all shrink-0 ${
                    i === currentStep
                      ? 'bg-[#002855] text-white'
                      : i < currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {i < currentStep ? (
                    <Check size={10} className="sm:size-[12px]" />
                  ) : (
                    <span className="text-[9px] sm:text-[11px]">{i + 1}</span>
                  )}
                  <span className="truncate max-w-[70px] sm:max-w-none">{step.title}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`w-4 sm:w-8 h-px ${i < currentStep ? 'bg-blue-400' : 'bg-slate-300'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 flex flex-col min-h-0"
        >
          <DetailModalBody className="p-2 sm:p-5 md:p-6 lg:p-8">
            {error && (
              <div ref={errorRef} className="bg-rose-50 border border-rose-100 p-4 flex items-center gap-3 text-rose-800">
                <AlertCircle size={20} />
                <p className="text-[11px] font-normal tracking-widest">{error}</p>
              </div>
            )}

            {stepErrors[currentStep] && (
              <div className="bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-3 text-amber-800 shadow-sm">
                <AlertCircle size={16} className="shrink-0 text-amber-500" />
                <p className="text-[11px] font-normal tracking-wide">{stepErrors[currentStep]}</p>
              </div>
            )}

            <div data-step={currentStep}>
              {children[currentStep]}
            </div>
          </DetailModalBody>

          {/* Footer */}
          <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div>
              {!isFirst && (
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={loading || submitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[10px] font-normal uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {!isLast ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-6 py-2.5 min-h-[44px] text-[10px] font-normal uppercase tracking-wide text-white bg-[#002855] hover:bg-blue-800 transition-all"
                >
                  Siguiente
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || submitting}
                  className="flex items-center gap-2 px-8 py-2.5 min-h-[44px] text-[10px] font-normal uppercase tracking-wide text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg"
                >
                  {(loading || submitting) && <Loader size={14} />}
                  {(loading || submitting) ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
