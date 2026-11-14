import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dailyReportHandler from '../api/daily-report';
import sendOutreachHandler from '../api/send-outreach';
import { createOutreach, createRenewal, searchBusinesses } from '../api/_lib/openai';


const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://lead-mgmt-ffdb6.web.app',
    'https://lead-mgmt-ffdb6.firebaseapp.com',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.post('/api/search', async (req, res) => {
  const { location, keyword, radius = 5, maxResults = 10 } = req.body;
  if (!location || !keyword) return res.status(400).json({ error: 'location and keyword are required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const { data, usage } = await searchBusinesses(location, keyword, radius, maxResults);
    return res.json({ results: data, usage });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
});

app.post('/api/outreach', async (req, res) => {
  const { lead, tone = 'professional' } = req.body;
  if (!lead?.name) return res.status(400).json({ error: 'lead is required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const { data, usage } = await createOutreach(lead, tone);
    return res.json({ ...data, usage });
  } catch (error) {
    console.error('Outreach error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Outreach generation failed' });
  }
});

app.post('/api/renewal', async (req, res) => {
  const { client } = req.body;
  if (!client?.name) return res.status(400).json({ error: 'client is required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const { data, usage } = await createRenewal(client);
    return res.json({ ...data, usage });
  } catch (error) {
    console.error('Renewal error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Renewal generation failed' });
  }
});

app.all('/api/daily-report', (req, res) => dailyReportHandler(req as any, res as any));
app.all('/api/send-outreach', (req, res) => sendOutreachHandler(req as any, res as any));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`OpenAI server running on port ${PORT}`));
