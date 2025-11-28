import { getPersonnelList } from '../../lib/notion';
import cors from 'cors';

// Configure CORS
const corsMiddleware = cors({
    methods: ['GET', 'HEAD'],
});

// Helper method to wait for a middleware to execute before continuing
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export default async function handler(req, res) {
    // Run the middleware
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        const personnel = await getPersonnelList();
        res.status(200).json(personnel);
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({ error: 'Failed to fetch personnel list' });
    }
}
