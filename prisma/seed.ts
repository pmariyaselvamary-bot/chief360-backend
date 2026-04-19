import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seeds the database with initial data for a demo executive account.
 * Creates: 1 user, 3 roles, sample tasks, sample schedules, sample notifications.
 */
async function main() {
    console.log('🌱 Starting seed...');

    // Clean existing data
    await prisma.notification.deleteMany();
    await prisma.task.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();

    // Create executive user
    const hashedPassword = await bcrypt.hash('chief360', 10);
    const user = await prisma.user.create({
        data: {
            name: 'Chief Executive',
            email: 'ceo@chief360.ai',
            password: hashedPassword,
            role: 'Chief Executive Officer',
        }
    });
    console.log(`✅ Created user: ${user.email}`);

    // Create Roles / Entities
    const roles = await Promise.all([
        prisma.role.create({
            data: {
                userId: user.id,
                name: 'TechCorp Solutions',
                title: 'Chief Executive Officer',
                icon: 'Building2',
                active: true,
                hours: 18.5,
                taskCount: 8,
                kpiStatus: 'On Track',
                color: '#f72585'
            }
        }),
        prisma.role.create({
            data: {
                userId: user.id,
                name: 'Global Ventures',
                title: 'Board Member',
                icon: 'Briefcase',
                active: false,
                hours: 6.2,
                taskCount: 3,
                kpiStatus: 'Needs Attention',
                color: '#7209b7'
            }
        }),
        prisma.role.create({
            data: {
                userId: user.id,
                name: 'Phoenix Foundation',
                title: 'Trustee',
                icon: 'GraduationCap',
                active: false,
                hours: 8.0,
                taskCount: 4,
                kpiStatus: 'Ahead',
                color: '#3b82f6'
            }
        })
    ]);
    console.log(`✅ Created ${roles.length} roles`);

    // Create Tasks with realistic deadlines
    const now = new Date();
    const tasks = await Promise.all([
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Finalize Q3 Revenue Strategy Document',
                context: 'TechCorp Solutions',
                deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days
                highImpact: true
            }
        }),
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Review Board Proposal for Series C',
                context: 'Global Ventures',
                deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
                highImpact: true
            }
        }),
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Approve Scholarship Program Budget',
                context: 'Phoenix Foundation',
                deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
                highImpact: false
            }
        }),
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Product Launch Go/No-Go Decision',
                context: 'TechCorp Solutions',
                deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
                highImpact: true
            }
        }),
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Prepare Foundation Annual Report',
                context: 'Phoenix Foundation',
                deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
                highImpact: false
            }
        }),
        prisma.task.create({
            data: {
                userId: user.id,
                title: 'Investor Relations Update Call',
                context: 'Global Ventures',
                deadline: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days
                highImpact: false
            }
        }),
    ]);
    console.log(`✅ Created ${tasks.length} tasks`);

    // Create Schedule Blocks for today
    const todayBase = new Date();
    todayBase.setHours(0, 0, 0, 0);

    const schedules = await Promise.all([
        prisma.schedule.create({
            data: {
                userId: user.id,
                title: 'Strategic Planning — Q3 Roadmap',
                type: 'working',
                startTime: new Date(todayBase.getTime() + 9 * 60 * 60 * 1000),   // 09:00
                endTime: new Date(todayBase.getTime() + 11.5 * 60 * 60 * 1000),  // 11:30
                context: 'TechCorp Solutions'
            }
        }),
        prisma.schedule.create({
            data: {
                userId: user.id,
                title: 'Lunch & Recovery',
                type: 'free',
                startTime: new Date(todayBase.getTime() + 12 * 60 * 60 * 1000),  // 12:00
                endTime: new Date(todayBase.getTime() + 13 * 60 * 60 * 1000),    // 13:00
                context: null
            }
        }),
        prisma.schedule.create({
            data: {
                userId: user.id,
                title: 'Board Presentation Prep',
                type: 'planning',
                startTime: new Date(todayBase.getTime() + 13.5 * 60 * 60 * 1000), // 13:30
                endTime: new Date(todayBase.getTime() + 15 * 60 * 60 * 1000),     // 15:00
                context: 'Global Ventures'
            }
        }),
        prisma.schedule.create({
            data: {
                userId: user.id,
                title: 'Foundation Donor Meeting',
                type: 'working',
                startTime: new Date(todayBase.getTime() + 15.5 * 60 * 60 * 1000), // 15:30
                endTime: new Date(todayBase.getTime() + 17 * 60 * 60 * 1000),     // 17:00
                context: 'Phoenix Foundation'
            }
        }),
        prisma.schedule.create({
            data: {
                userId: user.id,
                title: 'Evening Wind-Down & Reflection',
                type: 'free',
                startTime: new Date(todayBase.getTime() + 17.5 * 60 * 60 * 1000), // 17:30
                endTime: new Date(todayBase.getTime() + 18 * 60 * 60 * 1000),     // 18:00
                context: null
            }
        })
    ]);
    console.log(`✅ Created ${schedules.length} schedule blocks`);

    // Create Notifications
    const notifications = await Promise.all([
        prisma.notification.create({
            data: {
                userId: user.id,
                title: 'Schedule Overlap Detected',
                message: 'Board Prep and Foundation Donor Meeting have only 30 minutes buffer. Consider adjusting.',
                type: 'warning',
                icon: 'AlertTriangle',
                read: false
            }
        }),
        prisma.notification.create({
            data: {
                userId: user.id,
                title: 'Intelligence Brief Ready',
                message: 'Your weekly performance snapshot and strategic delegation suggestions are compiled.',
                type: 'info',
                icon: 'Bell',
                read: false
            }
        }),
        prisma.notification.create({
            data: {
                userId: user.id,
                title: 'Deep Work Block Secured',
                message: 'Protected 2.5 hours for Q3 Roadmap strategy successfully.',
                type: 'success',
                icon: 'CheckSquare',
                read: true
            }
        }),
        prisma.notification.create({
            data: {
                userId: user.id,
                title: 'High-Impact Deadline Approaching',
                message: 'Product Launch Go/No-Go Decision is due tomorrow. Ensure all stakeholders are aligned.',
                type: 'warning',
                icon: 'Clock',
                read: false
            }
        }),
    ]);
    console.log(`✅ Created ${notifications.length} notifications`);

    console.log('\n🎉 Seed complete!');
    console.log(`\n📋 Login Credentials:`);
    console.log(`   Email:    ceo@chief360.ai`);
    console.log(`   Password: chief360`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
