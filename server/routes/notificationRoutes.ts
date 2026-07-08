import { Router, Request, Response } from "express";
import { notificationService } from "../services/notificationService";
import { notificationTriggers } from "../services/notificationTriggers";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";

export const notificationRoutes = Router();

// Get user notifications (self only)
notificationRoutes.get("/api/notifications/:userId", async (req: Request, res: Response) => {
  try {
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.params.userId !== authUserId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const notifications = await notificationService.getUserNotifications(authUserId, limit);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Mark notification as read (must own the notification)
notificationRoutes.post("/api/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { id } = req.params;

    const existing = await storage.getNotificationById(id);
    if (!existing || existing.userId !== authUserId) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const updatedNotification = await notificationService.markAsRead(id);
    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(updatedNotification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// Test notification endpoint (authenticated; always targets the caller's own account)
notificationRoutes.post("/api/notifications/test", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { type, amount, merchant } = req.body;

    let notification;

    switch (type) {
      case 'roundup':
        notification = await notificationService.sendRoundUpNotification(userId, amount, merchant);
        break;
      case 'payment_due':
        notification = await notificationService.sendPaymentDueNotification(userId, 'Chase Freedom', amount, 3);
        break;
      case 'milestone':
        notification = await notificationService.sendMilestoneNotification(userId, '$50 in round-ups collected!', 25);
        break;
      case 'weekly_report':
        notification = await notificationService.sendWeeklyReportNotification(userId, amount, '156.72', 2);
        break;
      case 'crypto':
        notification = await notificationService.sendCryptoUpdateNotification(userId, amount, '125.50', '12.30');
        break;
      case 'motivation':
        notification = await notificationService.sendMotivationalNotification(userId, '');
        break;
      case 'debt_timeline':
        notification = await notificationService.sendDebtTimelineNotification(userId, 3, 'March 2026');
        break;
      case 'interest_savings':
        notification = await notificationService.sendInterestSavingsNotification(userId, '47.50', 'nice dinner out');
        break;
      case 'competitive_savings':
        notification = await notificationService.sendCompetitiveSavingsNotification(userId, 85, '23.45');
        break;
      case 'axos_earnings':
        notification = await notificationService.sendAxosEarningsNotification(userId, '3.47', '28.50', 'movie night');
        break;
      case 'dtt_rewards':
        notification = await notificationService.sendDTTRewardsNotification(userId, '0.0047', '12.50', '0.2456');
        break;
      case 'debt_avalanche':
        notification = await notificationService.sendDebtAvalancheNotification(userId, 'Chase Freedom', '89');
        break;
      case 'streak_maintenance':
        notification = await notificationService.sendStreakMaintenanceNotification(userId, 47, 'Make a purchase today');
        break;
      case 'morning_motivation':
        notification = await notificationService.sendMorningMotivationNotification(userId, '5.00', 'You\'re building momentum');
        break;
      case 'evening_celebration':
        notification = await notificationService.sendEveningCelebrationNotification(userId, '7.23', 'Great job today');
        break;
      case 'premium_teaser':
        notification = await notificationService.sendPremiumTeaserNotification(userId, 'Debt Consolidation', '89');
        break;
      case 'weekly_challenge':
        notification = await notificationService.sendWeeklyChallengeNotification(userId, 'Save $25 in round-ups', 'bonus 50 DTT tokens');
        break;
      default:
        return res.status(400).json({ message: "Invalid notification type" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: "Failed to send notification" });
  }
});

// Trigger notification events manually (authenticated; always targets the caller's own account)
notificationRoutes.post("/api/notifications/trigger", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { event, data } = req.body;

    switch (event) {
      case 'roundup_collected':
        await notificationTriggers.onRoundUpCollected(userId, data.transactionId, data.amount, data.merchant);
        break;
      case 'debt_payment':
        await notificationTriggers.onDebtPaymentProcessed(userId, data.debtId, data.amount);
        break;
      case 'crypto_investment':
        await notificationTriggers.onCryptoInvestment(userId, data.amount, data.symbol);
        break;
      default:
        return res.status(400).json({ message: "Invalid event type" });
    }

    res.json({ success: true, message: `${event} notification triggered` });
  } catch (error) {
    console.error('Error triggering notification:', error);
    res.status(500).json({ message: "Failed to trigger notification" });
  }
});

// Enable/disable browser notifications
notificationRoutes.post("/api/notifications/browser-permission", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { permission } = req.body;

    // This endpoint acknowledges the browser notification permission status
    // Actual permission handling is done client-side

    res.json({
      success: true,
      message: `Browser notifications ${permission}`,
      permission
    });
  } catch (error) {
    console.error('Error handling browser permission:', error);
    res.status(500).json({ message: "Failed to update browser permission" });
  }
});

// Get notification statistics (self only)
notificationRoutes.get("/api/notifications/:userId/stats", async (req: Request, res: Response) => {
  try {
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.params.userId !== authUserId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allNotifications = await notificationService.getUserNotifications(authUserId, 100);
    const unreadCount = allNotifications.filter(n => n.status === 'pending' || n.status === 'sent').length;
    const totalCount = allNotifications.length;

    const typeStats = allNotifications.reduce((stats: any, notification) => {
      stats[notification.type] = (stats[notification.type] || 0) + 1;
      return stats;
    }, {});

    res.json({
      unreadCount,
      totalCount,
      typeStats,
      recentNotifications: allNotifications.slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ message: "Failed to fetch notification statistics" });
  }
});
