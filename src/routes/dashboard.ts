import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/dashboard/metrics
 * Computes real-time dashboard data from the user's roles, tasks, and schedules.
 */
router.get('/metrics', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        // Get roles with concentration percentages
        const roles = await prisma.role.findMany({
            where: { userId },
            orderBy: { hours: 'desc' }
        });

        const totalHours = roles.reduce((sum, r) => sum + r.hours, 0);
        const roleConcentration = roles.map(r => ({
            name: r.name,
            title: r.title,
            percentage: totalHours > 0 ? Math.round((r.hours / totalHours) * 100) : 0,
            active: r.active
        }));

        // Get today's schedule blocks for deep work allocation
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todaySchedules = await prisma.schedule.findMany({
            where: {
                userId,
                startTime: { gte: todayStart },
                endTime: { lte: todayEnd }
            },
            orderBy: { startTime: 'asc' }
        });

        const deepWorkBlocks = todaySchedules
            .filter(s => s.type === 'working' || s.type === 'planning')
            .map(s => ({
                title: s.title,
                type: s.type,
                startTime: s.startTime,
                endTime: s.endTime,
                context: s.context
            }));

        // Compute strategic score from task completion + schedule adherence
        const allTasks = await prisma.task.findMany({ where: { userId } });
        const completedTasks = allTasks.filter(t => t.completed).length;
        const totalTasks = allTasks.length;
        const taskScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 50;

        // Factor in role balance + task progress for strategic score
        const roleBalance = roles.length > 0 ? Math.min(100, Math.round(100 - Math.abs(50 - (roleConcentration[0]?.percentage || 50)))) : 50;
        const strategicScore = Math.round((taskScore * 0.6) + (roleBalance * 0.4));

        // Detect conflicts: overlapping schedule blocks within next 7 days
        const weekAhead = new Date();
        weekAhead.setDate(weekAhead.getDate() + 7);

        const upcomingSchedules = await prisma.schedule.findMany({
            where: {
                userId,
                startTime: { gte: new Date() },
                endTime: { lte: weekAhead }
            },
            orderBy: { startTime: 'asc' }
        });

        const conflicts: { type: string; message: string; blocks: string[] }[] = [];
        for (let i = 0; i < upcomingSchedules.length - 1; i++) {
            const current = upcomingSchedules[i];
            const next = upcomingSchedules[i + 1];
            if (current.endTime > next.startTime) {
                conflicts.push({
                    type: 'overlap',
                    message: `"${current.title}" overlaps with "${next.title}" — buffer time is insufficient.`,
                    blocks: [current.title, next.title]
                });
            }
        }

        // Intelligence brief items from real data
        const briefItems: string[] = [];

        // Check if too much time on one role
        if (roleConcentration.length > 0 && roleConcentration[0].percentage > 60) {
            briefItems.push(`You are spending ${roleConcentration[0].percentage}% of time on ${roleConcentration[0].name}. Consider redistributing focus across other roles.`);
        }

        // Check overdue tasks
        const overdueTasks = allTasks.filter(t => !t.completed && new Date(t.deadline) < new Date());
        if (overdueTasks.length > 0) {
            briefItems.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} past deadline. Immediate attention required.`);
        }

        // Check high-impact tasks
        const pendingHighImpact = allTasks.filter(t => !t.completed && t.highImpact);
        if (pendingHighImpact.length > 0) {
            briefItems.push(`${pendingHighImpact.length} high-impact task${pendingHighImpact.length > 1 ? 's' : ''} pending. Prioritize before end of day.`);
        }

        // If no issues, give positive feedback
        if (briefItems.length === 0) {
            briefItems.push('All systems nominal. No critical issues detected across your roles.');
        }

        res.json({
            strategicScore,
            roleConcentration,
            deepWorkBlocks,
            conflicts,
            briefItems,
            stats: {
                totalTasks,
                completedTasks,
                pendingTasks: totalTasks - completedTasks,
                totalRoles: roles.length,
                totalScheduleBlocks: todaySchedules.length
            }
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
