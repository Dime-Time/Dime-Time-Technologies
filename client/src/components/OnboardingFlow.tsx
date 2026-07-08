import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Coins, Target, TrendingUp, Sparkles, CheckCircle, Play, ChevronLeft } from "lucide-react";

interface OnboardingFlowProps {
  userName: string;
  onComplete: () => void;
}

export default function OnboardingFlow({ userName, onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'welcome',
      title: `Welcome to Dime Time, ${userName}!`,
      subtitle: "Your journey to debt freedom starts now",
      content: (
        <div className="text-center space-y-8 py-4">
          <div className="w-20 h-20 bg-dime-purple/10 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-10 h-10 text-dime-purple" />
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Get out of debt one dime at a time
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Dime Time automatically rounds up your purchases and uses that spare change to pay down your debt faster than you ever thought possible.
            </p>
          </div>
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 text-left max-w-sm mx-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Example</p>
            <p className="text-sm text-slate-700 flex flex-col gap-2">
              <span className="flex justify-between items-center border-b border-slate-200 pb-2">
                Buy coffee <span className="font-semibold text-slate-900">$4.75</span>
              </span>
              <span className="flex justify-between items-center border-b border-slate-200 pb-2">
                We round up to <span className="font-semibold text-slate-900">$5.00</span>
              </span>
              <span className="flex justify-between items-center text-dime-purple font-medium pt-1">
                Goes to debt <span className="font-bold tabular-nums">+$0.25</span>
              </span>
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'how-it-works',
      title: "Here's How It Works",
      subtitle: "Three simple steps to financial freedom",
      content: (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-slate-700 font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">Smart Round-ups</h4>
              <p className="text-sm text-slate-500 leading-relaxed">Every purchase gets rounded up to the nearest dollar automatically</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-slate-700 font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">Weekly Payments</h4>
              <p className="text-sm text-slate-500 leading-relaxed">Your round-ups are collected and sent to your highest-interest debt</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-slate-700 font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">Track Progress</h4>
              <p className="text-sm text-slate-500 leading-relaxed">Watch your debt shrink and see your projected debt-free date</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: "Powerful Features",
      subtitle: "Everything you need for financial success",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-3">
              <Coins className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-semibold text-slate-900 mb-1.5">Crypto Integration</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Optional: Invest round-ups in Bitcoin and use gains for extra debt payments</p>
          </div>
          
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
            <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="font-semibold text-slate-900 mb-1.5">Smart Analytics</h4>
            <p className="text-xs text-slate-500 leading-relaxed">See exactly when you'll be debt-free and track your progress daily</p>
          </div>
          
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
            <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-rose-600" />
            </div>
            <h4 className="font-semibold text-slate-900 mb-1.5">Debt Optimization</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Automatically targets highest-interest debt first for maximum savings</p>
          </div>
          
          <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-slate-900 mb-1.5">Bank Integration</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Secure connections to 11,000+ banks and credit unions via Plaid</p>
          </div>
        </div>
      )
    },
    {
      id: 'success-story',
      title: "Real Results",
      subtitle: "See what's possible with Dime Time",
      content: (
        <div className="text-center py-4">
          <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-100">
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Average User Results
              </h3>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center divide-x divide-slate-200">
                <div className="px-2">
                  <div className="text-xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">$47</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">Weekly savings</div>
                </div>
                <div className="px-2">
                  <div className="text-xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">18</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">Months faster</div>
                </div>
                <div className="px-2">
                  <div className="text-xl sm:text-3xl font-bold text-dime-purple tabular-nums tracking-tight">$3.2k</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">Interest saved</div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-600 italic leading-relaxed">
                  "I paid off my $8,000 credit card debt 18 months faster just with round-ups. It felt effortless!"
                </p>
                <p className="text-xs font-semibold text-slate-900 mt-3">— Sarah M.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ready',
      title: "Ready to Start?",
      subtitle: "Your debt-free journey begins now",
      content: (
        <div className="text-center space-y-8 py-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Play className="w-10 h-10 text-emerald-500 ml-1" />
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              Let's set up your account
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Connect your bank account to start tracking purchases and see your first round-ups within 24 hours.
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-left">
            <p className="text-sm text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <strong>Next:</strong> Add debt info & connect your bank
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-xl max-h-[95vh] overflow-y-auto shadow-2xl border-none">
        <CardHeader className="pb-4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                  {currentStepData.title}
                </CardTitle>
                <p className="text-sm text-slate-500 font-medium">{currentStepData.subtitle}</p>
              </div>
              <button 
                onClick={onComplete}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold uppercase tracking-wider py-2 px-3 rounded-md hover:bg-slate-50 transition-colors shrink-0 press-scale"
                data-testid="button-skip-onboarding"
              >
                Skip
              </button>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-1.5 bg-slate-100" />
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Step {currentStep + 1} of {steps.length}</span>
                <span className="text-dime-purple">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="min-h-[260px] flex flex-col justify-center">
            {currentStepData.content}
          </div>
          
          <div className="flex justify-between pt-6 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`text-slate-500 hover:text-slate-900 hover:bg-slate-100 ${currentStep === 0 ? 'opacity-0' : 'opacity-100'} transition-opacity`}
              data-testid="button-previous-step"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              className="bg-dime-purple text-white hover:bg-dime-purple/90 min-w-[120px] shadow-sm press-scale"
              data-testid={currentStep === steps.length - 1 ? "button-start-journey" : "button-next-step"}
            >
              {currentStep === steps.length - 1 ? "Start My Journey" : "Continue"}
              {currentStep !== steps.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
