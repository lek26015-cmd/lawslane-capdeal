'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Cookie, CheckCircle2, ShieldCheck, Settings2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Small delay to make it feel less intrusive
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (consent: 'all' | 'essential') => {
    localStorage.setItem('cookie_consent', consent);
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-6 left-0 right-0 z-[9999] px-4"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 p-6 md:p-10 flex flex-col lg:flex-row items-center gap-8">
              
              {/* Cookie Icon Section */}
              <div className="hidden md:flex flex-shrink-0 w-24 h-24 bg-blue-50 rounded-3xl items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                  <Cookie className="h-10 w-10 text-blue-600" />
                </div>
              </div>

              {/* Text Content Section */}
              <div className="flex-grow space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex -space-x-1">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
                    Guaranteed Privacy Standard
                  </span>
                </div>
                
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 font-headline tracking-tight">
                  ยกระดับประสบการณ์ให้เหมาะสมกับคุณ
                </h2>
                
                <p className="text-slate-500 leading-relaxed text-[15px] md:text-base max-w-3xl">
                  เราใช้คุกกี้เพื่อวิเคราะห์การใช้งานและมอบข้อเสนอพิเศษที่ตรงใจคุณมากที่สุด 
                  คุณร่วมเป็นส่วนหนึ่งของการพัฒนาประสบการณ์ได้โดยการยอมรับคุกกี้ของเรา 
                  อ่านเพิ่มเติมได้ที่{' '}
                  <Link href="/privacy" className="text-blue-600 font-bold hover:underline">
                    นโยบายความเป็นส่วนตัว
                  </Link>
                </p>
              </div>

              {/* Actions Section */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 w-full lg:w-auto flex-shrink-0">
                <Button
                  onClick={() => handleConsent('all')}
                  className="bg-[#0F172A] hover:bg-[#1e293b] text-white rounded-2xl h-14 px-8 text-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
                >
                  <Check className="w-5 h-5" />
                  ยอมรับทั้งหมด
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleConsent('essential')}
                    className="flex-grow bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl h-14 px-6 text-sm font-bold border border-slate-100 transition-all"
                  >
                    จำเป็นเท่านั้น
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-14 h-14 p-0 rounded-2xl border-slate-100 bg-slate-50 flex items-center justify-center hover:bg-slate-100 text-slate-600 transition-all"
                    title="ตั้งค่าคุกกี้"
                  >
                    <Settings2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
