import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// All schedule routes now use JWT auth
router.use(authMiddleware);

// Get all schedules for the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const schedules = await prisma.schedule.findMany({
            where: { userId: req.userId! },
            orderBy: { startTime: 'asc' }
        });
        res.json(schedules);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Add a new schedule block
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, type, startTime, endTime, context } = req.body;
        const savedSchedule = await prisma.schedule.create({
            data: {
                userId: req.userId!,
                title,
                type,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                context
            }
        });

        res.status(201).json(savedSchedule);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a schedule block
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const scheduleId = req.params.id as string;

        const existing = await prisma.schedule.findFirst({
            where: { id: scheduleId, userId: req.userId! }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Schedule not found' });
        }

        await prisma.schedule.delete({ where: { id: scheduleId } });
        res.json({ message: 'Schedule deleted' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
