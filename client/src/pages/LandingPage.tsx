import { LogoWithText } from "@/components/logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#918EF4] text-white flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center space-y-8 text-center">
        <div className="flex items-center justify-center scale-150 md:scale-200">
          <LogoWithText />
        </div>
        
        <h1 className="text-3xl md:text-5xl font-bold text-white max-w-2xl leading-tight" data-testid="text-headline">
          Get out of debt one dime at a time, with Dime Time.
        </h1>

        <p className="text-2xl md:text-3xl text-white/90 font-semibold" data-testid="text-coming-soon">
          Coming soon!!
        </p>
      </div>

      <footer className="absolute bottom-8 text-white/60 text-sm">
        &copy; 2025 Dime Time Technologies. All rights reserved.
      </footer>
    </div>
  );
}
