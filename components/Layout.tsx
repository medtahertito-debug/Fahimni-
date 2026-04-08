
import React from 'react';
import { AppStep } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  step: AppStep;
  onBack?: () => void;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, step, onBack, title }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="gradient-bg text-white py-6 px-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <span className="text-2xl">🎓</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">فهمني</h1>
          </div>
          {onBack && step !== AppStep.COUNTRY_SELECTION && (
            <button 
              onClick={onBack}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <span>رجوع</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
        {title && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center">{title}</h2>
            <div className="h-1.5 w-24 bg-blue-500 mx-auto mt-3 rounded-full"></div>
          </div>
        )}
        {children}
      </main>

      <footer className="py-8 text-center text-slate-400 text-sm border-t border-slate-200">
        <p>© {new Date().getFullYear()} فهمني - منصة الطالب العربي التعليمية</p>
        <p className="mt-1">جميع الحقوق محفوظة للمصادر الرسمية ووزارات التربية</p>
      </footer>
    </div>
  );
};

export default Layout;
