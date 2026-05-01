import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jwt-simple';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../index';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-1234';

// 1. Signup
router.post('/signup', async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password required." });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        });

        const token = jwt.encode({ id: user.id, email: user.email }, JWT_SECRET);
        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, isTwoFactorEnabled: user.isTwoFactorEnabled } });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // If 2FA is required, we don't issue the full token yet
        if (user.isTwoFactorEnabled) {
            return res.status(200).json({ requires2FA: true, userId: user.id });
        }

        const token = jwt.encode({ id: user.id, email: user.email }, JWT_SECRET);
        return res.json({ token, user: { id: user.id, name: user.name, email: user.email, isTwoFactorEnabled: false } });
    } catch (error: unknown) {
        if (error instanceof Error) {
            return res.status(500).json({ message: error.message });
        }
        return res.status(500).json({ message: "Unknown error occurred" });
    }
});

// 3. Setup 2FA Enrolment
router.post('/2fa/setup', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body; // In real app, extract from auth token
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const secret = speakeasy.generateSecret({ name: `Chief360 (${user.email})` });

        // Save the secret temporarily or permanently
        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: secret.base32 }
        });

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || "");
        res.json({ secret: secret.base32, qrCodeUrl });

    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Verify 2FA & Issue Token
router.post('/2fa/verify', async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.twoFactorSecret) return res.status(400).json({ message: "2FA not setup properly" });

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (!verified) {
            return res.status(401).json({ message: "Invalid 2FA code" });
        }

        // Mark as enabled if this is their first verification during setup
        if (!user.isTwoFactorEnabled) {
            await prisma.user.update({ where: { id: user.id }, data: { isTwoFactorEnabled: true } });
        }

        const jwtToken = jwt.encode({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email, isTwoFactorEnabled: true } });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});
// 5. Forgot Password
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "Email not found." });
        }
        const resetToken = jwt.encode({ id: user.id, email: user.email, purpose: 'reset' }, JWT_SECRET);
        const resetLink = `https://chief360-web.vercel.app/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Chief360 - Password Reset Link',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <a href="${resetLink}" style="background:#F72585;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Reset Password</a>
                <p>This link expires in 1 hour.</p>
                <p>If you did not request this, ignore this email.</p>
            `,
        });
        res.json({ message: "Password reset link sent to your email!" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
