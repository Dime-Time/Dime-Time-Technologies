import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell, 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  Zap,
  TestTube
} from "lucide-react";

export default function NotificationTest() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const testNotification = async (type: string, data: any = {}) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/notifications/test', {
        type,
        ...data
      });

      // apiRequest throws on non-2xx, so reaching here means success.
      await response.json();
      toast({
        title: "✅ Notification Sent!",
        description: `Test ${type} notification delivered successfully`,
      });

      // Show browser notification if permission granted
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Test ${type} notification`, {
          body: `Successfully tested ${type} notification`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      toast({
        title: permission === 'granted' ? "✅ Permission Granted" : "⚠️ Permission Denied",
        description: permission === 'granted' 
          ? "You'll now receive push notifications!" 
          : "Enable notifications in browser settings to receive alerts",
      });
    }
  };

  const notificationTypes = [
    {
      type: 'roundup',
      icon: DollarSign,
      title: 'Round-up Collected',
      description: 'Test round-up notification',
      color: 'text-green-500',
      data: { amount: '2.47', merchant: 'Starbucks' }
    },
    {
      type: 'debt_timeline',
      icon: Zap,
      title: 'Debt Timeline Update',
      description: 'Smart timeline calculation',
      color: 'text-purple-500',
      data: { monthsReduced: 3, debtFreeDate: 'March 2026' }
    },
    {
      type: 'interest_savings',
      icon: DollarSign,
      title: 'Interest Savings Alert',
      description: 'Monthly interest saved',
      color: 'text-green-500',
      data: { amountSaved: '47.50', realWorldComparison: 'nice dinner out' }
    },
    {
      type: 'competitive_savings',
      icon: TrendingUp,
      title: 'Competitive Savings',
      description: 'Top performer notification',
      color: 'text-orange-500',
      data: { percentile: 85, weeklyAmount: '23.45' }
    },
    {
      type: 'axos_earnings',
      icon: CreditCard,
      title: 'Axos 4% APY Earnings',
      description: 'Interest earnings update',
      color: 'text-blue-500',
      data: { weeklyEarnings: '3.47', totalEarnings: '28.50', realWorldValue: 'movie night' }
    },
    {
      type: 'dtt_rewards',
      icon: Bell,
      title: 'DTT Rewards Earned',
      description: 'Native token rewards',
      color: 'text-yellow-500',
      data: { tokensEarned: '0.0047', dollarValue: '12.50', totalTokens: '0.2456' }
    },
    {
      type: 'debt_avalanche',
      icon: Zap,
      title: 'Smart Debt Strategy',
      description: 'Optimization recommendation',
      color: 'text-purple-500',
      data: { recommendedDebt: 'Chase Freedom', potentialSavings: '89' }
    },
    {
      type: 'streak_maintenance',
      icon: TrendingUp,
      title: 'Streak Maintenance',
      description: 'Don\'t break your streak',
      color: 'text-red-500',
      data: { streakDays: 47, nextAction: 'Make a purchase today' }
    },
    {
      type: 'morning_motivation',
      icon: Bell,
      title: 'Morning Motivation',
      description: 'Daily goal setting',
      color: 'text-yellow-500',
      data: { dailyGoal: '5.00', progressMessage: 'You\'re building momentum' }
    },
    {
      type: 'evening_celebration',
      icon: Calendar,
      title: 'Evening Celebration',
      description: 'Daily progress recap',
      color: 'text-green-500',
      data: { dailyAmount: '7.23', encouragementMessage: 'Great job today' }
    },
    {
      type: 'premium_teaser',
      icon: DollarSign,
      title: 'Premium Feature Teaser',
      description: 'Upgrade opportunity',
      color: 'text-indigo-500',
      data: { featureName: 'Debt Consolidation', potentialSavings: '89' }
    },
    {
      type: 'weekly_challenge',
      icon: TrendingUp,
      title: 'Weekly Challenge',
      description: 'Gamification feature',
      color: 'text-pink-500',
      data: { challengeGoal: 'Save $25 in round-ups', bonusReward: 'bonus 50 DTT tokens' }
    }
  ];

  return (
    <Card className="border-2 border-dashed border-gray-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Notification Testing Center
        </CardTitle>
        <CardDescription>
          Test different notification types to verify the push notification system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Section */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/10 rounded-lg">
          <h4 className="font-medium mb-2">Browser Notifications</h4>
          <p className="text-sm text-gray-600 mb-3">
            Enable browser notifications to receive real-time alerts
          </p>
          <Button onClick={requestNotificationPermission} variant="outline" size="sm">
            <Bell className="h-4 w-4 mr-2" />
            Enable Notifications
          </Button>
        </div>

        {/* Test Notifications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notificationTypes.map((notification) => {
            const IconComponent = notification.icon;
            return (
              <div 
                key={notification.type}
                className="p-4 border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <IconComponent className={`h-5 w-5 ${notification.color}`} />
                  <div>
                    <h5 className="font-medium">{notification.title}</h5>
                    <p className="text-sm text-gray-600">{notification.description}</p>
                  </div>
                </div>
                <Button
                  onClick={() => testNotification(notification.type, notification.data)}
                  disabled={isLoading}
                  size="sm"
                  className="w-full"
                  data-testid={`button-test-${notification.type}`}
                >
                  Test {notification.title}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Status Info */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant="outline">Development Mode</Badge>
            <span>Notifications will appear in browser and console</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}