import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router({ mergeParams: true });

const DATA_DIR = path.join(process.cwd(), 'data', 'analysis');

router.post('/', async (req: Request<{ simId: string }>, res: Response) => {
  const { simId } = req.params;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${simId}.json`);
    await fs.writeFile(filePath, JSON.stringify(req.body), 'utf-8');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/', async (req: Request<{ simId: string }>, res: Response) => {
  const { simId } = req.params;
  try {
    const filePath = path.join(DATA_DIR, `${simId}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: 'Analysis not found' });
  }
});

export default router;
