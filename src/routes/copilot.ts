import express, { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.use(authMiddleware);

/**
 * POST /api/copilot/query
 * Context-aware AI copilot that responds based on the user's actual data.
 * Analyzes roles, tasks, schedules, and notifications to provide actionable insights.
 */
router.post('/query', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Query message is required.' });
        }

        const query = message.toLowerCase().trim();

        // Fetch the user's live data context
        const [user, roles, tasks, schedules, notifications] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
            prisma.role.findMany({ where: { userId } }),
            prisma.task.findMany({ where: { userId }, orderBy: { deadline: 'asc' } }),
            prisma.schedule.findMany({ where: { userId }, orderBy: { startTime: 'asc' } }),
            prisma.notification.findMany({ where: { userId, read: false } }),
        ]);

        const userName = user?.name || 'Executive';
        let response = '';

        // Build the live context string to inject into the LLM
        let contextData = `User: ${userName}\n`;
        contextData += `Active Context: ${roles.find(r => r.active)?.title || 'None'}\n\n`;

        contextData += `--- ROLES ---\n`;
        if (roles.length === 0) contextData += `No roles configured.\n`;
        roles.forEach(r => {
            contextData += `- ${r.name} (${r.title}) [Hours Allocated: ${r.hours}, High-Impact Tasks: ${r.taskCount}, KPI Status: ${r.kpiStatus}]\n`;
        });

        contextData += `\n--- SCHEDULE ---\n`;
        if (schedules.length === 0) contextData += `No schedule blocks.\n`;
        schedules.forEach(s => {
            const start = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            contextData += `- ${start} to ${end}: ${s.title} [Type: ${s.type.toUpperCase()}]${s.context ? ` (Context: ${s.context})` : ''}\n`;
        });

        contextData += `\n--- PENDING TASKS ---\n`;
        const pendingTasks = tasks.filter(t => !t.completed);
        if (pendingTasks.length === 0) contextData += `All tasks completed.\n`;
        pendingTasks.forEach(t => {
            const deadline = new Date(t.deadline).toLocaleDateString();
            contextData += `- [${t.highImpact ? 'HIGH IMPACT' : 'NORMAL'}] ${t.title} (Deadline: ${deadline}, Context: ${t.context})\n`;
        });

        contextData += `\n--- NOTIFICATIONS ---\n`;
        contextData += `Unread Alerts: ${notifications.length}\n`;

        const systemPrompt = `You are Chief360 Copilot, an elite AI assistant for high-level executives.
You are interacting with ${userName}.
You have been provided with their LIVE database snapshot containing their exact schedule, tasks, roles, and priorities.
When the user asks a question, answer it by analyzing the LIVE DATA provided below. 
Do NOT invent tasks or schedules. If the data shows conflicts, point them out. If asked for a status or summary, provide a concise, high-level executive briefing.
Keep your responses professional, incredibly concise, and actionable. Do not use markdown headers larger than h3. Do not ramble.

LIVE DATA SNAPSHOT:
${contextData}`;

        const chatResponse = await anthropic.messages.create({
           model: 'claude-haiku-4-5',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [{ role: 'user', content: query }]
        });
        response = (chatResponse.content[0] as any).text;
        res.json({ response });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
