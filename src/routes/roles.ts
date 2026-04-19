import express, { Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/roles — Get all roles for authenticated user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            where: { userId: req.userId! },
            orderBy: { createdAt: 'asc' }
        });
        res.json(roles);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/roles — Create a new role
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name, title, icon, active, hours, taskCount, kpiStatus, color } = req.body;
        const role = await prisma.role.create({
            data: {
                userId: req.userId!,
                name,
                title,
                icon: icon || 'Building2',
                active: active || false,
                hours: hours || 0,
                taskCount: taskCount || 0,
                kpiStatus: kpiStatus || 'On Track',
                color: color || '#f72585'
            }
        });
        res.status(201).json(role);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/roles/:id — Update a role
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const roleId = req.params.id as string;
        const existing = await prisma.role.findFirst({
            where: { id: roleId, userId: req.userId! }
        });
        if (!existing) return res.status(404).json({ message: 'Role not found' });

        const { name, title, icon, hours, taskCount, kpiStatus, color } = req.body;
        const role = await prisma.role.update({
            where: { id: roleId },
            data: {
                ...(name !== undefined && { name }),
                ...(title !== undefined && { title }),
                ...(icon !== undefined && { icon }),
                ...(hours !== undefined && { hours }),
                ...(taskCount !== undefined && { taskCount }),
                ...(kpiStatus !== undefined && { kpiStatus }),
                ...(color !== undefined && { color })
            }
        });
        res.json(role);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// PATCH /api/roles/:id/activate — Switch context to this role
router.patch('/:id/activate', async (req: AuthRequest, res: Response) => {
    try {
        const roleId = req.params.id as string;
        const existing = await prisma.role.findFirst({
            where: { id: roleId, userId: req.userId! }
        });
        if (!existing) return res.status(404).json({ message: 'Role not found' });

        // Deactivate all user's roles first
        await prisma.role.updateMany({
            where: { userId: req.userId! },
            data: { active: false }
        });

        // Activate the selected role
        const role = await prisma.role.update({
            where: { id: roleId },
            data: { active: true }
        });

        res.json(role);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/roles/:id — Delete a role
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const roleId = req.params.id as string;
        const existing = await prisma.role.findFirst({
            where: { id: roleId, userId: req.userId! }
        });
        if (!existing) return res.status(404).json({ message: 'Role not found' });

        await prisma.role.delete({ where: { id: roleId } });
        res.json({ message: 'Role deleted' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
