import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/intelligence/brief
 * Computes strategic intelligence analytics from real user data.
 */
router.get('/brief', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        // Gather all user data for analysis
        const [roles, tasks, schedules] = await Promise.all([
            prisma.role.findMany({ where: { userId } }),
            prisma.task.findMany({ where: { userId }, orderBy: { deadline: 'asc' } }),
            prisma.schedule.findMany({ where: { userId }, orderBy: { startTime: 'asc' } }),
        ]);

        // --- Weekly Executive Summary ---
        const totalHours = roles.reduce((sum, r) => sum + r.hours, 0);
        const topRole = roles.sort((a, b) => b.hours - a.hours)[0];
        const completedCount = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        let weeklySummary = '';
        if (topRole && totalHours > 0) {
            const topPct = Math.round((topRole.hours / totalHours) * 100);
            weeklySummary = `Your time allocation shows ${topRole.name} (${topRole.title}) consuming ${topPct}% of your deep work blocks. `;

            if (topPct > 60) {
                const neglectedRoles = roles.filter(r => r.id !== topRole.id);
                if (neglectedRoles.length > 0) {
                    weeklySummary += `${neglectedRoles.map(r => r.name).join(' and ')} ${neglectedRoles.length > 1 ? 'are' : 'is'} receiving limited attention and may need rebalancing.`;
                }
            } else {
                weeklySummary += `This shows a balanced distribution across your responsibilities.`;
            }
        } else {
            weeklySummary = 'No time allocation data available yet. Start by setting up your roles and scheduling deep work blocks.';
        }

        weeklySummary += ` Task completion rate stands at ${completionRate}% (${completedCount}/${totalTasks}).`;

        // --- Decision Fatigue Analysis ---
        const highImpactTasksToday = tasks.filter(t => t.highImpact && !t.completed);
        const fatigueLevel = Math.min(100, highImpactTasksToday.length * 15);
        let fatigueStatus = 'Optimal';
        let fatigueColor = 'green';
        if (fatigueLevel > 70) {
            fatigueStatus = 'Critical';
            fatigueColor = 'red';
        } else if (fatigueLevel > 40) {
            fatigueStatus = 'Elevated';
            fatigueColor = 'amber';
        }

        // --- Conflict Forecast (30-day) ---
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

        const upcomingSchedules = await prisma.schedule.findMany({
            where: {
                userId,
                startTime: { gte: new Date() },
                endTime: { lte: thirtyDaysOut }
            },
            orderBy: { startTime: 'asc' }
        });

        const conflictForecast: {
            date: Date;
            severity: 'critical' | 'warning';
            title: string;
            description: string;
            blocks: string[];
        }[] = [];

        for (let i = 0; i < upcomingSchedules.length - 1; i++) {
            const current = upcomingSchedules[i];
            const next = upcomingSchedules[i + 1];
            if (current.endTime > next.startTime) {
                const overlapMinutes = Math.round((current.endTime.getTime() - next.startTime.getTime()) / 60000);
                conflictForecast.push({
                    date: next.startTime,
                    severity: overlapMinutes > 60 ? 'critical' : 'warning',
                    title: overlapMinutes > 60 ? 'Critical Overlap' : 'Buffer Warning',
                    description: `"${current.title}" overlaps with "${next.title}" by ${overlapMinutes} minutes.`,
                    blocks: [current.title, next.title]
                });
            }
        }

        // --- Predicted Next Drain ---
        let predictedDrain = '';
        const workingBlocks = upcomingSchedules.filter(s => s.type === 'working');
        // Find consecutive working blocks with < 30min break
        for (let i = 0; i < workingBlocks.length - 1; i++) {
            const gap = (workingBlocks[i + 1].startTime.getTime() - workingBlocks[i].endTime.getTime()) / 60000;
            if (gap < 30) {
                const startTime = workingBlocks[i].startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endTime = workingBlocks[i + 1].endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                predictedDrain = `Back-to-back sessions from ${startTime} to ${endTime} with only ${Math.round(gap)}min break. Consider adding buffer time to avoid cognitive overload.`;
                break;
            }
        }

        if (!predictedDrain) {
            predictedDrain = 'No imminent cognitive drain detected. Schedule spacing looks healthy.';
        }

        res.json({
            weeklySummary,
            fatigue: {
                level: fatigueLevel,
                status: fatigueStatus,
                color: fatigueColor,
                description: fatigueLevel > 40
                    ? `High-impact decision load is elevated. ${highImpactTasksToday.length} critical tasks require attention.`
                    : 'Recovery protocol healthy. Ready for high-impact decision making.'
            },
            predictedDrain,
            conflictForecast,
            stats: {
                totalRoles: roles.length,
                totalHoursAllocated: totalHours,
                completionRate,
                pendingHighImpact: highImpactTasksToday.length,
                upcomingConflicts: conflictForecast.length
            }
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
