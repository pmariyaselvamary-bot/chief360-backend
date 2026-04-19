import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/users/me — Get current user profile
router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                isTwoFactorEnabled: true,
                createdAt: true,
            }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/users/me — Update user profile
router.put('/me', async (req: AuthRequest, res: Response) => {
    try {
        const { name, role } = req.body;
        const updateData: any = {};
        if (name) updateData.name = name;
        if (role) updateData.role = role;

        const user = await prisma.user.update({
            where: { id: req.userId! },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                isTwoFactorEnabled: true,
            }
        });
        res.json(user);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/users/me/avatar — Update avatar
router.put('/me/avatar', async (req: AuthRequest, res: Response) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ message: 'Image data required' });

        const user = await prisma.user.update({
            where: { id: req.userId! },
            data: { avatarUrl: image },
            select: { avatarUrl: true }
        });
        res.json({ avatarUrl: user.avatarUrl });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
