import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/notifications — Get all notifications for user (newest first)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.userId! },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/notifications — Create a notification
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, message, type, icon } = req.body;
        const notification = await prisma.notification.create({
            data: {
                userId: req.userId!,
                title,
                message,
                type: type || 'info',
                icon: icon || 'Bell'
            }
        });

        // Send email notification via Resend
        try {
            const user = await prisma.user.findUnique({ where: { id: req.userId! } });
            if (user?.email) {
                const { Resend } = await import('resend');
                const resend = new Resend(process.env.RESEND_API_KEY);
                await resend.emails.send({
                    from: 'Chief360 <onboarding@resend.dev>',
                    to: user.email,
                    subject: `⏰ Chief360 - ${title}`,
                    html: `<h2>${title}</h2><p>${message}</p>`,
                });
            }
        } catch (e) {}

        res.status(201).json(notification);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// PATCH /api/notifications/:id/read — Mark a single notification as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        const notifId = req.params.id as string;
        const existing = await prisma.notification.findFirst({
            where: { id: notifId, userId: req.userId! }
        });
        if (!existing) return res.status(404).json({ message: 'Notification not found' });

        const notification = await prisma.notification.update({
            where: { id: notifId },
            data: { read: true }
        });
        res.json(notification);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// PATCH /api/notifications/read-all — Mark all notifications as read
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.userId!, read: false },
            data: { read: true }
        });
        res.json({ message: 'All notifications marked as read' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/notifications/:id — Dismiss/delete a notification
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const notifId = req.params.id as string;
        const existing = await prisma.notification.findFirst({
            where: { id: notifId, userId: req.userId! }
        });
        if (!existing) return res.status(404).json({ message: 'Notification not found' });

        await prisma.notification.delete({ where: { id: notifId } });
        res.json({ message: 'Notification dismissed' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});
// POST /api/notifications/send-push — Send FCM push notification
router.post('/send-push', async (req: AuthRequest, res: Response) => {
    try {
        const { title, message, fcmToken } = req.body;
        if (!fcmToken) return res.status(400).json({ message: "FCM token required" });
        
        const { firebaseAdmin } = await import('../index');
        await firebaseAdmin.messaging().send({
            token: fcmToken,
            notification: {
                title,
                body: message,
            },
            android: {
                priority: 'high',
            },
        });
        res.json({ message: "Push notification sent!" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
