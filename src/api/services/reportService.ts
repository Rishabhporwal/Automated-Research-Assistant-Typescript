import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { ModelLoader } from '../../utils/modelLoader';
import { AutonomousReportGenerator } from '../../workflows/ReportGeneratorWorkflow';
import { Logger } from '../../utils/logger';
import { ResearchAnalystException } from '../../utils/exceptions';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ReportStatusData {
  status: 'in_progress' | 'completed' | 'error' | 'unknown';
  thread_id?: string;
  docx_path?: string;
  pdf_path?: string;
  final_report?: string;
  error?: string;
}

export interface StartReportData {
  thread_id: string;
}

export class ReportService {
  private llm: any;
  private reporter: AutonomousReportGenerator;
  private workflows: Map<string, any>;
  private logger: Logger;

  constructor() {
    this.workflows = new Map();
    this.logger = new Logger('ReportService');
    this.llm = null as any;
    this.reporter = null as any;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const modelLoader = new ModelLoader();
      this.llm = await modelLoader.loadLLM();
      this.reporter = new AutonomousReportGenerator(this.llm);
      this.logger.info('Report service initialized successfully');
    } catch (error: any) {
      this.logger.error('Error initializing report service', { error: error.message });
      // Continue with mock LLM for now
      this.reporter = new AutonomousReportGenerator({
        invoke: async (messages: any[]) => ({
          content: `Mock LLM response to: ${messages[messages.length - 1]?.content || 'No message'}`
        })
      });
    }
  }

  async startReportGeneration(topic: string, maxAnalysts: number = 3): Promise<ApiResponse<StartReportData>> {
    try {
      const threadId = uuidv4();
      this.logger.info('Starting report pipeline', { topic, thread_id: threadId });

      // Store workflow state
      this.workflows.set(threadId, {
        thread_id: threadId,
        topic,
        max_analysts: maxAnalysts,
        status: 'in_progress',
        start_time: new Date()
      });

      // Execute workflow asynchronously
      this.executeWorkflow(threadId, topic, maxAnalysts);

      return {
        success: true,
        data: { thread_id: threadId },
        message: 'Pipeline initiated successfully.'
      };
    } catch (error: any) {
      this.logger.error('Error initiating report generation', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async executeWorkflow(threadId: string, topic: string, maxAnalysts: number): Promise<void> {
    try {
      if (!this.reporter) {
        await this.initialize();
      }

      const result = await this.reporter.executeWorkflow(topic, maxAnalysts);
      
      // Update workflow state
      this.workflows.set(threadId, {
        ...this.workflows.get(threadId),
        ...result,
        status: 'completed',
        end_time: new Date()
      });
      
      this.logger.info('Workflow completed', { thread_id: threadId });
    } catch (error: any) {
      this.logger.error('Error executing workflow', { thread_id: threadId, error: error.message });
      
      // Store error state
      this.workflows.set(threadId, {
        ...this.workflows.get(threadId),
        status: 'error',
        error: error.message,
        end_time: new Date()
      });
    }
  }

  async submitFeedback(threadId: string, feedback: string): Promise<ApiResponse> {
    try {
      const workflow = this.workflows.get(threadId);
      if (!workflow) {
        return {
          success: false,
          error: `Workflow with thread_id ${threadId} not found`
        };
      }

      // Update state with feedback and restart workflow
      workflow.feedback = feedback;
      this.workflows.set(threadId, workflow);

      // Restart workflow with new feedback
      await this.executeWorkflow(threadId, workflow.topic, workflow.max_analysts);

      return {
        success: true,
        message: 'Feedback processed successfully'
      };
    } catch (error: any) {
      this.logger.error('Error updating feedback', { thread_id: threadId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReportStatus(threadId: string): Promise<ApiResponse<ReportStatusData>> {
    try {
      const workflow = this.workflows.get(threadId);
      if (!workflow) {
        return {
          success: false,
          error: `Workflow with thread_id ${threadId} not found`
        };
      }

      const status = workflow.status || 'unknown';
      const finalReport = workflow.final_report;

      if (status === 'completed' && finalReport) {
        // Generate report files
        const docxPath = await this.reporter.saveReport(finalReport, workflow.topic, 'docx');
        const pdfPath = await this.reporter.saveReport(finalReport, workflow.topic, 'pdf');

        return {
          success: true,
          data: {
            status: 'completed',
            thread_id: threadId,
            docx_path: docxPath,
            pdf_path: pdfPath,
            final_report: finalReport
          }
        };
      }

      return {
        success: true,
        data: {
          status: status,
          thread_id: threadId,
          error: workflow.error
        }
      };
    } catch (error: any) {
      this.logger.error('Error fetching report status', { thread_id: threadId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async downloadFile(fileName: string): Promise<Buffer | null> {
    try {
      const reportDir = path.join(process.cwd(), 'generated_report');
      
      // Search for file in all subdirectories
      const files = await this.findFile(reportDir, fileName);
      
      if (files.length > 0) {
        return fs.readFileSync(files[0]);
      }
      
      return null;
    } catch (error: any) {
      this.logger.error('Error downloading file', { file_name: fileName, error: error.message });
      return null;
    }
  }

  private async findFile(dir: string, fileName: string): Promise<string[]> {
    const results: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return results;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        results.push(...await this.findFile(fullPath, fileName));
      } else if (item === fileName) {
        results.push(fullPath);
      }
    }
    
    return results;
  }
}