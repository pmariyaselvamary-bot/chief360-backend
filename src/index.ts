import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import scheduleRoutes from './routes/schedules';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import intelligenceRoutes from './routes/intelligence';
import copilotRoutes from './routes/copilot';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: ['https://chief360-web.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/copilot', copilotRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Chief360 Copilot Production API is running' });
});

// Seed endpoint — creates demo data
app.post('/api/seed', async (req, res) => {
    try {
        // Clean existing data
        await prisma.notification.deleteMany();
        await prisma.task.deleteMany();
        await prisma.schedule.deleteMany();
        await prisma.role.deleteMany();
        await prisma.user.deleteMany();

        const hashedPassword = await bcrypt.hash('chief360', 10);
        const user = await prisma.user.create({
            data: {
                name: 'Chief Executive',
                email: 'ceo@chief360.ai',
                password: hashedPassword,
                role: 'Chief Executive Officer',
            }
        });

        // Create roles
        await prisma.role.createMany({
            data: [
                { userId: user.id, name: 'TechCorp Solutions', title: 'CEO', icon: 'Building2', active: true, hours: 18.5, taskCount: 8, kpiStatus: 'On Track', color: '#f72585' },
                { userId: user.id, name: 'Global Ventures', title: 'Board Member', icon: 'Briefcase', active: false, hours: 6.2, taskCount: 3, kpiStatus: 'Needs Attention', color: '#7209b7' },
                { userId: user.id, name: 'Phoenix Foundation', title: 'Trustee', icon: 'GraduationCap', active: false, hours: 8.0, taskCount: 4, kpiStatus: 'Ahead', color: '#3b82f6' },
            ]
        });

        const now = new Date();
        // Create tasks
        await prisma.task.createMany({
            data: [
                { userId: user.id, title: 'Finalize Q3 Revenue Strategy', context: 'TechCorp Solutions', deadline: new Date(now.getTime() + 2 * 86400000), highImpact: true },
                { userId: user.id, title: 'Review Board Proposal for Series C', context: 'Global Ventures', deadline: new Date(now.getTime() + 3 * 86400000), highImpact: true },
                { userId: user.id, title: 'Approve Scholarship Program Budget', context: 'Phoenix Foundation', deadline: new Date(now.getTime() + 5 * 86400000), highImpact: false },
                { userId: user.id, title: 'Product Launch Go/No-Go Decision', context: 'TechCorp Solutions', deadline: new Date(now.getTime() + 1 * 86400000), highImpact: true },
                { userId: user.id, title: 'Prepare Foundation Annual Report', context: 'Phoenix Foundation', deadline: new Date(now.getTime() + 7 * 86400000), highImpact: false },
                { userId: user.id, title: 'Investor Relations Update Call', context: 'Global Ventures', deadline: new Date(now.getTime() + 4 * 86400000), highImpact: false },
            ]
        });

        const todayBase = new Date();
        todayBase.setHours(0, 0, 0, 0);
        // Create schedule blocks
        await prisma.schedule.createMany({
            data: [
                { userId: user.id, title: 'Strategic Planning — Q3 Roadmap', type: 'working', startTime: new Date(todayBase.getTime() + 9 * 3600000), endTime: new Date(todayBase.getTime() + 11.5 * 3600000), context: 'TechCorp Solutions' },
                { userId: user.id, title: 'Lunch & Recovery', type: 'free', startTime: new Date(todayBase.getTime() + 12 * 3600000), endTime: new Date(todayBase.getTime() + 13 * 3600000) },
                { userId: user.id, title: 'Board Presentation Prep', type: 'planning', startTime: new Date(todayBase.getTime() + 13.5 * 3600000), endTime: new Date(todayBase.getTime() + 15 * 3600000), context: 'Global Ventures' },
                { userId: user.id, title: 'Foundation Donor Meeting', type: 'working', startTime: new Date(todayBase.getTime() + 15.5 * 3600000), endTime: new Date(todayBase.getTime() + 17 * 3600000), context: 'Phoenix Foundation' },
                { userId: user.id, title: 'Evening Wind-Down', type: 'free', startTime: new Date(todayBase.getTime() + 17.5 * 3600000), endTime: new Date(todayBase.getTime() + 18 * 3600000) },
            ]
        });

        // Create notifications
        await prisma.notification.createMany({
            data: [
                { userId: user.id, title: 'Schedule Overlap Detected', message: 'Board Prep and Foundation Meeting have limited buffer time.', type: 'warning', icon: 'AlertTriangle' },
                { userId: user.id, title: 'Intelligence Brief Ready', message: 'Weekly performance snapshot and delegation suggestions compiled.', type: 'info', icon: 'Bell' },
                { userId: user.id, title: 'Deep Work Block Secured', message: 'Protected 2.5 hours for Q3 Roadmap strategy.', type: 'success', icon: 'CheckSquare', read: true },
                { userId: user.id, title: 'High-Impact Deadline Approaching', message: 'Product Launch Go/No-Go Decision is due tomorrow.', type: 'warning', icon: 'Clock' },
            ]
        });

        res.json({ message: 'Seed complete!', credentials: { email: 'ceo@chief360.ai', password: 'chief360' } });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Server] Chief360 Copilot API running on http://localhost:${PORT}`);
});
