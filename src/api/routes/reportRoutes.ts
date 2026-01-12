import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ReportService } from '../services/reportService';

const router = Router();
const reportService = new ReportService();

// In-memory session store
const sessions = new Map<string, string>();

// Helper function to render templates
const renderTemplate = (templateName: string, data: any = {}): string => {
  const templatePath = path.join(__dirname, '../../templates', templateName);
  
  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`Template not found: ${templateName} at ${templatePath}`);
    
    // Return a simple HTML page
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Research Analyst</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
          h1 { color: #333; }
          .card { background: #f9f9f9; padding: 30px; border-radius: 10px; display: inline-block; }
          .error { color: #c33; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Research Analyst</h1>
          ${data.error ? `<div class="error">${data.error}</div>` : ''}
          <p>${templateName} page</p>
          <p><a href="/">Home</a> | <a href="/dashboard">Dashboard</a></p>
        </div>
      </body>
      </html>
    `;
  }

  try {
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Handle error display
    if (data.error) {
      template = template.replace('{{error}}', `<div class="error">${data.error}</div>`);
    } else {
      template = template.replace('{{error}}', '');
    }
    
    // Simple variable replacement
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'error') {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(placeholder, String(value || ''));
      }
    });
    
    return template;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    return `<h1>Error loading template: ${templateName}</h1>`;
  }
};

// Authentication check
const checkAuth = (req: Request): boolean => {
  const sessionId = req.cookies?.session_id;
  return sessionId ? sessions.has(sessionId) : false;
};

// Routes
router.get('/', (req: Request, res: Response) => {
  if (checkAuth(req)) {
    return res.redirect('/dashboard');
  }
  const html = renderTemplate('login.html');
  res.send(html);
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // Simple authentication for development
    if (username === 'admin' && password === 'admin123') {
      const sessionId = `${username}_${Date.now()}`;
      sessions.set(sessionId, username);
      res.cookie('session_id', sessionId, { httpOnly: true });
      return res.redirect('/dashboard');
    }
    
    const html = renderTemplate('login.html', { error: 'Invalid username or password' });
    res.send(html);
  } catch (error: any) {
    console.error('Login error:', error);
    const html = renderTemplate('login.html', { error: 'Login failed' });
    res.status(500).send(html);
  }
});

router.get('/signup', (req: Request, res: Response) => {
  const html = renderTemplate('signup.html');
  res.send(html);
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      const html = renderTemplate('signup.html', { error: 'Username and password are required' });
      return res.send(html);
    }
    
    if (password.length > 72) {
      const html = renderTemplate('signup.html', { error: 'Password cannot exceed 72 characters' });
      return res.send(html);
    }
    
    // For development: just log and redirect to login
    console.log(`New user signup attempted: ${username}`);
    return res.redirect('/');
  } catch (error: any) {
    console.error('Signup error:', error);
    const html = renderTemplate('signup.html', { error: 'Signup failed' });
    res.status(500).send(html);
  }
});

router.get('/dashboard', (req: Request, res: Response) => {
  if (!checkAuth(req)) {
    return res.redirect('/');
  }
  
  const sessionId = req.cookies.session_id;
  const user = sessions.get(sessionId) || 'User';
  
  const html = renderTemplate('dashboard.html', { user });
  res.send(html);
});

router.post('/generate_report', async (req: Request, res: Response) => {
  if (!checkAuth(req)) {
    return res.redirect('/');
  }
  
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim() === '') {
      const sessionId = req.cookies.session_id;
      const user = sessions.get(sessionId) || 'User';
      const html = renderTemplate('dashboard.html', { 
        user,
        error: 'Please enter a topic'
      });
      return res.status(400).send(html);
    }
    
    const result = await reportService.startReportGeneration(topic, 3);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate report');
    }
    
    if (!result.data || !result.data.thread_id) {
      throw new Error('Invalid response from report service');
    }
    
    const html = renderTemplate('report_progress.html', {
      topic,
      feedback: '',
      thread_id: result.data.thread_id
    });
    
    res.send(html);
  } catch (error: any) {
    console.error('Report generation error:', error);
    const sessionId = req.cookies.session_id;
    const user = sessions.get(sessionId) || 'User';
    const html = renderTemplate('dashboard.html', { 
      user,
      error: 'Failed to generate report: ' + error.message
    });
    res.status(500).send(html);
  }
});

router.post('/submit_feedback', async (req: Request, res: Response) => {
  if (!checkAuth(req)) {
    return res.redirect('/');
  }
  
  try {
    const { topic, feedback, thread_id } = req.body;
    
    if (!thread_id) {
      const html = renderTemplate('report_progress.html', {
        topic: topic || '',
        feedback: feedback || '',
        thread_id: '',
        error: 'Thread ID is required'
      });
      return res.status(400).send(html);
    }
    
    const result = await reportService.submitFeedback(thread_id, feedback || '');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to submit feedback');
    }
    
    // Get updated status
    const statusResult = await reportService.getReportStatus(thread_id);
    
    let doc_path = '';
    let pdf_path = '';
    
    if (statusResult.success && statusResult.data) {
      if (statusResult.data.docx_path) {
        const fullPath = statusResult.data.docx_path;
        doc_path = fullPath.split('/').pop() || '';
      }
      if (statusResult.data.pdf_path) {
        const fullPath = statusResult.data.pdf_path;
        pdf_path = fullPath.split('/').pop() || '';
      }
    }
    
    const html = renderTemplate('report_progress.html', {
      topic: topic || '',
      feedback: feedback || '',
      thread_id,
      doc_path,
      pdf_path
    });
    
    res.send(html);
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    const html = renderTemplate('report_progress.html', {
      topic: req.body.topic || '',
      feedback: req.body.feedback || '',
      thread_id: req.body.thread_id || '',
      error: 'Failed to process feedback: ' + error.message
    });
    res.status(500).send(html);
  }
});

router.get('/download/:fileName', async (req: Request, res: Response) => {
  if (!checkAuth(req)) {
    return res.redirect('/');
  }
  
  try {
    const { fileName } = req.params;
    
    // Basic security check
    if (!fileName || fileName.includes('..') || fileName.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    
    const fileBuffer = await reportService.downloadFile(fileName);
    
    if (!fileBuffer) {
      return res.status(404).json({ error: `File ${fileName} not found` });
    }
    
    const ext = path.extname(fileName).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : 
                       ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBuffer);
  } catch (error: any) {
    console.error('Download error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API Routes
router.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'research-report-generation',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/test', (req: Request, res: Response) => {
  res.json({
    message: 'API is working',
    sessions: Array.from(sessions.entries()).map(([id, user]) => ({ id, user }))
  });
});

export { router as reportRoutes };