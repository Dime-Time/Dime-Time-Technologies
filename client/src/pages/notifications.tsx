import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotificationTest from "@/components/NotificationTest";
import { 
  Bell, 
  BellRing, 
  Check, 
  Clock, 
  CreditCard, 
  DollarSign, 
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Settings as SettingsIcon,
  TestTube
} from "lucide-react";

interface Notification {
  id: string;
  type: "payment" | "roundup" | "crypto" | "milestone" | "reminder" | "system";
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: "low" | "medium" | "high";
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "milestone",
      title: "Round-up Milestone Reached!",
      message: "Congratulations! You've saved $16.36 in round-ups this month.",
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      isRead: false,
      priority: "high",
    },
    {
      id: "2",
      type: "payment",
      title: "Payment Due Reminder",
      message: "Your Chase Freedom Card payment of $165.00 is due in 3 days.",
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      isRead: false,
      priority: "high",
    },
    {
      id: "3",
      type: "crypto",
      title: "Crypto Purchase Complete",
      message: "Successfully invested $0.21 in Bitcoin from your latest round-up.",
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      isRead: true,
      priority: "medium",
    },
    {
      id: "4",
      type: "roundup",
      title: "Weekly Round-up Summary",
      message: "This week you collected $4.85 in round-ups across 12 transactions.",
      timestamp: new Date(Date.now() - 259200000), // 3 days ago
      isRead: true,
      priority: "medium",
    },
    {
      id: "5",
      type: "system",
      title: "Account Security Update",
      message: "Your account security settings have been updated successfully.",
      timestamp: new Date(Date.now() - 432000000), // 5 days ago
      isRead: true,
      priority: "low",
    },
    {
      id: "6",
      type: "reminder",
      title: "Monthly Progress Review",
      message: "Check out your debt reduction progress for this month!",
      timestamp: new Date(Date.now() - 604800000), // 1 week ago
      isRead: false,
      priority: "medium",
    },
  ]);

  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
    paymentReminders: true,
    roundupMilestones: true,
    cryptoUpdates: true,
    weeklyReports: true,
    marketingEmails: false,
  });

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <CreditCard className="h-5 w-5 text-blue-500" />;
      case "roundup":
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case "crypto":
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case "milestone":
        return <CheckCircle className="h-5 w-5 text-purple-500" />;
      case "reminder":
        return <Calendar className="h-5 w-5 text-yellow-500" />;
      case "system":
        return <Info className="h-5 w-5 text-slate-500" />;
      default:
        return <Bell className="h-5 w-5 text-slate-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-amber-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-slate-300";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return "Just now";
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <main className="min-h-[100dvh] pb-20 animate-fade-in-up">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-dime-purple/10 rounded-xl flex items-center justify-center">
                <Bell className="h-6 w-6 text-dime-purple" />
              </div>
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 rounded-full px-2.5">
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-slate-600 mt-2 ml-1 text-lg">Stay updated on your financial progress</p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" className="text-slate-700 press-scale">
              <Check className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className={`grid w-full mb-6 bg-slate-100/50 p-1 border ${import.meta.env.DEV ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:shadow-sm text-base py-2.5">
              <BellRing className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:shadow-sm text-base py-2.5">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
            {import.meta.env.DEV && (
              <TabsTrigger value="test" className="flex items-center gap-2 data-[state=active]:shadow-sm text-base py-2.5">
                <TestTube className="h-4 w-4" />
                Test
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="notifications" className="space-y-4 outline-none">
            {notifications.length === 0 ? (
              <Card className="shadow-card border-slate-200 border-dashed animate-fade-in">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No notifications</h3>
                  <p className="text-slate-500 font-medium">You're all caught up! Check back later for updates.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification, index) => (
                  <Card 
                    key={notification.id} 
                    className={`border-l-4 ${getPriorityColor(notification.priority)} shadow-card transition-colors hover:bg-slate-50/50 animate-fade-in-up`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center ${notification.isRead ? 'bg-slate-100' : 'bg-slate-100 ring-4 ring-slate-50'}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className={`text-base font-bold ${notification.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                                {notification.title}
                              </h4>
                              {!notification.isRead && (
                                <span className="flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-dime-purple opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-dime-purple"></span>
                                </span>
                              )}
                            </div>
                            <p className={`${notification.isRead ? 'text-slate-500' : 'text-slate-600 font-medium'} text-sm mb-3 leading-relaxed`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 border-0">
                                {notification.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                              className="text-slate-400 hover:text-green-600 hover:bg-green-50"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <Check className="h-5 w-5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete notification"
                            aria-label="Delete notification"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 outline-none animate-fade-in">
            <Card className="shadow-card">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-slate-900">Notification Preferences</CardTitle>
                <CardDescription className="text-base text-slate-600">
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div>
                      <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="push-enabled">Push Notifications</Label>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        Receive instant alerts on your device
                      </p>
                    </div>
                    <Switch
                      id="push-enabled"
                      checked={notificationSettings.pushEnabled}
                      onCheckedChange={(checked) =>
                        setNotificationSettings(prev => ({ ...prev, pushEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div>
                      <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="email-enabled">Email Notifications</Label>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        Get important updates via email
                      </p>
                    </div>
                    <Switch
                      id="email-enabled"
                      checked={notificationSettings.emailEnabled}
                      onCheckedChange={(checked) =>
                        setNotificationSettings(prev => ({ ...prev, emailEnabled: checked }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-5">
                  <h4 className="font-bold text-slate-900 text-lg">Notification Types</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="pref-payments">Payment Reminders</Label>
                          <p className="text-sm font-medium text-slate-500">Due date alerts and payment confirmations</p>
                        </div>
                      </div>
                      <Switch
                        id="pref-payments"
                        checked={notificationSettings.paymentReminders}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, paymentReminders: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="pref-roundup">Round-up Milestones</Label>
                          <p className="text-sm font-medium text-slate-500">Celebrate your savings achievements</p>
                        </div>
                      </div>
                      <Switch
                        id="pref-roundup"
                        checked={notificationSettings.roundupMilestones}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, roundupMilestones: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="pref-crypto">Crypto Updates</Label>
                          <p className="text-sm font-medium text-slate-500">Investment confirmations and portfolio updates</p>
                        </div>
                      </div>
                      <Switch
                        id="pref-crypto"
                        checked={notificationSettings.cryptoUpdates}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, cryptoUpdates: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="pref-reports">Weekly Reports</Label>
                          <p className="text-sm font-medium text-slate-500">Summary of your progress and activities</p>
                        </div>
                      </div>
                      <Switch
                        id="pref-reports"
                        checked={notificationSettings.weeklyReports}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <AlertCircle className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <Label className="text-base font-bold text-slate-900 cursor-pointer" htmlFor="pref-marketing">Marketing Emails</Label>
                          <p className="text-sm font-medium text-slate-500">Tips, promotions, and feature updates</p>
                        </div>
                      </div>
                      <Switch
                        id="pref-marketing"
                        checked={notificationSettings.marketingEmails}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, marketingEmails: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <Button className="w-full sm:w-auto bg-dime-purple hover:bg-dime-purple/90 text-white press-scale text-lg px-8 py-6 h-auto">
                    Save Notification Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-dime-purple/20 bg-dime-purple/5">
              <CardHeader>
                <CardTitle className="text-dime-purple text-xl">Push Notification Setup</CardTitle>
                <CardDescription className="text-slate-600 text-base font-medium">
                  Enable browser notifications for real-time updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-start gap-4 bg-white/60 p-5 rounded-xl border border-dime-purple/10">
                    <Info className="h-6 w-6 text-dime-purple mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">
                        Browser Notifications
                      </h4>
                      <p className="text-base font-medium text-slate-600 mt-2 leading-relaxed">
                        To receive push notifications about payments, round-ups, and security alerts, you'll need to allow notifications in your browser settings.
                      </p>
                    </div>
                  </div>
                  <Button 
                    className="w-full sm:w-auto press-scale bg-white text-dime-purple hover:bg-slate-50 border border-dime-purple/20 text-lg px-8 py-6 h-auto" 
                    onClick={() => {
                      if ("Notification" in window) {
                        Notification.requestPermission();
                      }
                    }}
                  >
                    Enable Browser Notifications
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {import.meta.env.DEV && (
            <TabsContent value="test" className="space-y-6 outline-none">
              <NotificationTest />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  );
}