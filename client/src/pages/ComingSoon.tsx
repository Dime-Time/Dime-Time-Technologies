import { LogoWithText } from "@/components/logo";

export default function ComingSoon() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 safe-area-top safe-area-bottom">
      <div style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(21%) saturate(2421%) hue-rotate(180deg) brightness(97%) contrast(92%)' }}>
        <LogoWithText size={150} />
      </div>
      
      <p className="text-slate-900 text-xl text-center mt-8 font-medium">
        Get out of debt one dime at a time
      </p>
      
      <p className="text-slate-600 text-lg text-center mt-4">
        Coming Soon!
      </p>
    </div>
  );
}
