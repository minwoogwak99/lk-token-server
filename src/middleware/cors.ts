import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests from localhost on any port for development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return origin;
    }
    // Allow requests from local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (origin && (
      origin.includes('192.168.') ||
      origin.includes('10.') ||
      /172\.(1[6-9]|2[0-9]|3[01])\./.test(origin)
    )) {
      return origin;
    }
    // Add your production domains here
    const allowedOrigins: string[] = [
      // Add your production client domain here when deploying
      // 'https://yourdomain.com'
    ];
    return allowedOrigins.includes(origin || '') ? origin : undefined;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
