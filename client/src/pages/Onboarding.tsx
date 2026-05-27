import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, TrendingUp, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { BetaModeBanner } from "@/components/BetaModeBanner";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const features = [
    {
      icon: DollarSign,
      title: "Round-up Technology",
      description: "Turn spare change into debt freedom",
      color: "from-purple-400 to-purple-600"
    },
    {
      icon: Calendar,
      title: "Smart Debt Payments",
      description: "Automated payments every Friday",
      color: "from-indigo-400 to-indigo-600"
    },
    {
      icon: TrendingUp,
      title: "Crypto Integration",
      description: "Invest round-ups in Bitcoin & crypto",
      color: "from-violet-400 to-violet-600"
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Track your debt-free journey",
      color: "from-purple-500 to-purple-700"
    }
  ];

  useEffect(() => {
    if (current === features.length - 1) {
      const timer = setTimeout(() => {
        setLocation("/dashboard");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [current, features.length, setLocation]);

  const handleGetStarted = () => {
    setLocation("/dashboard");
  };

  const goToNext = () => {
    if (current < features.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(current + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const goToPrev = () => {
    if (current > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(current - 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const goToSlide = (index: number) => {
    if (index !== current && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(index);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const feature = features[current];
  const Icon = feature.icon;

  return (
    <div className="min-h-screen bg-[#918EF4] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <div 
          className={`flex flex-col items-center justify-center min-h-[60vh] text-center px-6 transition-all duration-300 ${
            isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          data-testid={`slide-feature-${current}`}
        >
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center mb-8 shadow-2xl transform transition-transform hover:scale-110`}>
            <Icon className="w-12 h-12 text-white" data-testid={`icon-feature-${current}`} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid={`title-feature-${current}`}>
            {feature.title}
          </h2>
          <p className="text-xl text-white/90 mb-8" data-testid={`description-feature-${current}`}>
            {feature.description}
          </p>
        </div>

        {current > 0 && (
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all hover:scale-110"
            data-testid="button-prev"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {current < features.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all hover:scale-110"
            data-testid="button-next"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div className="flex flex-col items-center gap-6 mt-8">
          <div className="flex gap-2" data-testid="carousel-indicators">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  current === index ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                }`}
                data-testid={`indicator-${index}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <Button
            onClick={handleGetStarted}
            className="w-full max-w-xs bg-white text-[#918EF4] hover:bg-white/90 font-semibold text-lg py-6 shadow-lg transition-transform hover:scale-105"
            data-testid="button-get-started"
          >
            Get Started
          </Button>

          {current === features.length - 1 && (
            <p className="text-white/70 text-sm animate-pulse" data-testid="text-auto-navigate">
              Auto-navigating in 3 seconds...
            </p>
          )}

          <BetaModeBanner variant="inline-light" className="mt-2" />
          <p className="text-[11px] text-white/70 leading-snug text-center px-2">
            Dime Time is a financial technology platform and is not a bank.
            Banking services and payment infrastructure are provided through
            regulated financial partners.
          </p>
        </div>
      </div>
    </div>
  );
}
