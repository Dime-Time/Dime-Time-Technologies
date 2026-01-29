import { LogoWithText } from "@/components/logo";

export default function ComingSoon() {
  return (
    <div className="min-h-screen bg-[#918EF4] flex flex-col items-center justify-center px-6 safe-area-top safe-area-bottom">
      <LogoWithText size={150} />
      
      <p className="text-white text-xl text-center mt-8 font-medium">
        Get out of debt one dime at a time
      </p>
      
      <p className="text-white/80 text-lg text-center mt-4">
        Coming Soon!
      </p>
    </div>
  );
}
