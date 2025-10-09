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
        return <Info className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-300";
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
    <div className="min-h-screen" style={{ backgroundColor: '#918EF4' }}>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Bell className="h-8 w-8 text-white" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-white mt-2">Stay updated on your financial progress</p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" className="text-white border-white hover:bg-white hover:text-black">
              <Check className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className={`grid w-full ${import.meta.env.DEV ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
            {import.meta.env.DEV && (
              <TabsTrigger value="test" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Test
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            {notifications.length === 0 ? (
              <Card style={{ backgroundColor: '#918EF4', border: '1px solid rgba(255,255,255,0.2)' }}>
                <CardContent className="text-center py-12">
                  <Bell className="h-12 w-12 text-white mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
                  <p className="text-white">You're all caught up! Check back later for updates.</p>
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`border-l-4 ${getPriorityColor(notification.priority)}`}
                  style={{ backgroundColor: '#918EF4', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-white text-sm mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-white">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {notification.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card style={{ backgroundColor: '#918EF4', border: '1px solid rgba(255,255,255,0.2)' }}>
              <CardHeader>
                <CardTitle className="text-white">Notification Settings</CardTitle>
                <CardDescription className="text-white">
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium text-white">Push Notifications</Label>
                      <p className="text-sm text-white">
                        Receive instant alerts on your device
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushEnabled}
                      onCheckedChange={(checked) =>
                        setNotificationSettings(prev => ({ ...prev, pushEnabled: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium text-white">Email Notifications</Label>
                      <p className="text-sm text-white">
                        Get important updates via email
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailEnabled}
                      onCheckedChange={(checked) =>
                        setNotificationSettings(prev => ({ ...prev, emailEnabled: checked }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-white">Notification Types</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <div>
                          <Label className="text-white">Payment Reminders</Label>
                          <p className="text-xs text-white">Due date alerts and payment confirmations</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings.paymentReminders}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, paymentReminders: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <div>
                          <Label className="text-white">Round-up Milestones</Label>
                          <p className="text-xs text-white">Celebrate your savings achievements</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings.roundupMilestones}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, roundupMilestones: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        <div>
                          <Label className="text-white">Crypto Updates</Label>
                          <p className="text-xs text-white">Investment confirmations and portfolio updates</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings.cryptoUpdates}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, cryptoUpdates: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <div>
                          <Label className="text-white">Weekly Reports</Label>
                          <p className="text-xs text-white">Summary of your progress and activities</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings.weeklyReports}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <div>
                          <Label className="text-white">Marketing Emails</Label>
                          <p className="text-xs text-white">Tips, promotions, and feature updates</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings.marketingEmails}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, marketingEmails: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button>
                    Save Notification Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#918EF4', border: '1px solid rgba(255,255,255,0.2)' }}>
              <CardHeader>
                <CardTitle className="text-white">Push Notification Setup</CardTitle>
                <CardDescription className="text-white">
                  Enable browser notifications for real-time updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-white mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white">
                          Browser Notifications
                        </h4>
                        <p className="text-sm text-white mt-1">
                          To receive push notifications, you'll need to allow notifications in your browser settings.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => {
                    if ("Notification" in window) {
                      Notification.requestPermission();
                    }
                  }}>
                    Enable Browser Notifications
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {import.meta.env.DEV && (
            <TabsContent value="test" className="space-y-6">
              <NotificationTest />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}