import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// All task routes now use JWT auth
router.use(authMiddleware);

// Get all tasks for the authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const tasks = await prisma.task.findMany({
            where: { userId: req.userId! },
            orderBy: { deadline: 'asc' }
        });
        res.json(tasks);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new task
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { title, context, deadline, highImpact } = req.body;
        const savedTask = await prisma.task.create({
            data: {
                userId: req.userId!,
                title,
                context,
                deadline: new Date(deadline),
                highImpact: highImpact || false
            }
        });

        res.status(201).json(savedTask);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// Toggle task completion
router.patch('/:id/complete', async (req: AuthRequest, res: Response) => {
    try {
        const taskId = req.params.id as string;

        // Verify the task belongs to the authenticated user
        const existing = await prisma.task.findFirst({
            where: { id: taskId, userId: req.userId! }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const task = await prisma.task.update({
            where: { id: taskId },
            data: { completed: !existing.completed }
        });
        res.json(task);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a task
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const taskId = req.params.id as string;

        const existing = await prisma.task.findFirst({
            where: { id: taskId, userId: req.userId! }
        });
        if (!existing) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await prisma.task.delete({ where: { id: taskId } });
        res.json({ message: 'Task deleted' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
