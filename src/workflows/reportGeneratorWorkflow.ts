import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { PromptTemplates } from '../prompts/promptTemplates';
import { Logger } from '../utils/logger';
import { ResearchAnalystException } from '../utils/exceptions';
import { 
  GenerateAnalystsState,
  ResearchGraphState,
  Analyst
} from '../models/schemas';

// Simplified workflow without LangGraph for now
export class AutonomousReportGenerator {
  private llm: any;
  private logger: Logger;

  constructor(llm: any) {
    this.llm = llm;
    this.logger = new Logger('AutonomousReportGenerator');
  }

  // ----------------------------------------------------------------------
  // Create analyst personas
  // ----------------------------------------------------------------------
  async createAnalysts(input: {
    topic: string;
    max_analysts: number;
    human_analyst_feedback?: string;
  }): Promise<Analyst[] | any> {
    const { topic, max_analysts, human_analyst_feedback = '' } = input;

    try {
      this.logger.info('Creating analyst personas', { topic });
      
      const systemPrompt = PromptTemplates.CREATE_ANALYSTS_PROMPT(
        topic, 
        max_analysts, 
        human_analyst_feedback
      );
      
      const response = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: 'Generate the set of analysts.' })
      ]);

      // Parse response to extract analysts
      const analysts = this.parseAnalystsFromResponse(response.content);
      
      this.logger.info('Analysts created', { count: analysts.length, analysts: analysts });
      return analysts;
    } catch (error: any) {
      this.logger.error('Error creating analysts', { error: error.message });
      throw new ResearchAnalystException('Failed to create analysts', error);
    }
  }

  private parseAnalystsFromResponse(content: string): Analyst[] {
  const analysts: Analyst[] = [];
  const lines = content.split('\n');
  let currentAnalyst: Partial<Analyst> = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Remove any markdown formatting (*, **, etc.) before checking
    const cleanLine = trimmedLine.replace(/^\*\s*/, '').replace(/\*\*/g, '').trim();
    
    if (cleanLine.toLowerCase().startsWith('name:')) {
      if (currentAnalyst.name && Object.keys(currentAnalyst).length > 1) {
        // Fill missing fields before adding
        analysts.push(this.completeAnalyst(currentAnalyst));
      }
      // Start new analyst
      currentAnalyst = { 
        name: cleanLine.split(':')[1]?.trim() || 'Unknown Analyst'
      };
    } else if (cleanLine.toLowerCase().startsWith('role:')) {
      currentAnalyst.role = cleanLine.split(':')[1]?.trim();
    } else if (cleanLine.toLowerCase().startsWith('affiliation:')) {
      currentAnalyst.affiliation = cleanLine.split(':')[1]?.trim();
    } else if (cleanLine.toLowerCase().startsWith('description:')) {
      currentAnalyst.description = cleanLine.split(':')[1]?.trim();
    }
    // Also check for analyst number patterns (Analyst 1:, Analyst 2:, etc.)
    else if (cleanLine.toLowerCase().match(/^analyst\s*\d*:/i)) {
      if (currentAnalyst.name && Object.keys(currentAnalyst).length > 1) {
        analysts.push(this.completeAnalyst(currentAnalyst));
      }
      currentAnalyst = { 
        name: cleanLine.split(':')[1]?.trim() || cleanLine
      };
    }
  }
  
  // Add the last analyst if it exists
  if (currentAnalyst.name) {
    analysts.push(this.completeAnalyst(currentAnalyst));
  }
  
  // If no analysts found, create some from the content
  if (analysts.length === 0) {
    return this.createAnalystsFromContent(content);
  }
  
  return analysts;
}

private completeAnalyst(analyst: Partial<Analyst>): Analyst {
  // Fill in any missing fields with reasonable defaults
  return {
    name: analyst.name || 'Unknown Analyst',
    role: analyst.role || 'Research Analyst',
    affiliation: analyst.affiliation || 'AI Research Institute',
    description: analyst.description || 
      `${analyst.name || 'This analyst'} provides expert analysis on the topic.`
  };
}

private createAnalystsFromContent(content: string): Analyst[] {
  const analysts: Analyst[] = [];
  
  // Try to find proper names in the content (Capitalized names)
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const nameMatches = content.match(nameRegex) || [];
  
  // Take up to 3 unique names
  const uniqueNames = [...new Set(nameMatches)].slice(0, 3);
  
  for (let i = 0; i < Math.max(uniqueNames.length, 3); i++) {
    const name = uniqueNames[i] || `Analyst ${i + 1}`;
    
    analysts.push({
      name,
      role: i === 0 ? 'Senior Economist' : 
            i === 1 ? 'Data Analyst' : 
            'Research Analyst',
      affiliation: i === 0 ? 'Reserve Bank' : 
                  i === 1 ? 'Research Institute' : 
                  'AI Analytics',
      description: `${name} provides expert analysis and insights on the topic.`
    });
  }
  
  return analysts;
}

  // ----------------------------------------------------------------------
  // Write main report content
  // ----------------------------------------------------------------------
  async writeReport(sections: string[], topic: string): Promise<string> {
    try {
      if (sections.length === 0) {
        sections.push('No sections generated — please verify interview stage.');
      }
      
      this.logger.info('Writing report', { topic });
      const systemPrompt = PromptTemplates.REPORT_WRITER_INSTRUCTIONS(topic);
      const report = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: sections.join('\n\n') })
      ]);
      
      this.logger.info('Report written successfully');
      return report.content;
    } catch (error: any) {
      this.logger.error('Error writing main report', { error: error.message });
      throw new ResearchAnalystException('Failed to write main report', error);
    }
  }

  // ----------------------------------------------------------------------
  // Write introduction
  // ----------------------------------------------------------------------
  async writeIntroduction(sections: string[], topic: string): Promise<string> {
    try {
      const formattedSections = sections.join('\n\n');
      
      this.logger.info('Generating introduction', { topic });
      const systemPrompt = PromptTemplates.INTRO_CONCLUSION_INSTRUCTIONS(topic, formattedSections);
      const intro = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: 'Write the report introduction' })
      ]);
      
      this.logger.info('Introduction generated', { length: intro.content.length });
      return intro.content;
    } catch (error: any) {
      this.logger.error('Error generating introduction', { error: error.message });
      throw new ResearchAnalystException('Failed to generate introduction', error);
    }
  }

  // ----------------------------------------------------------------------
  // Write conclusion
  // ----------------------------------------------------------------------
  async writeConclusion(sections: string[], topic: string): Promise<string> {
    try {
      const formattedSections = sections.join('\n\n');
      
      this.logger.info('Generating conclusion', { topic });
      const systemPrompt = PromptTemplates.INTRO_CONCLUSION_INSTRUCTIONS(topic, formattedSections);
      const conclusion = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: 'Write the report conclusion' })
      ]);
      
      this.logger.info('Conclusion generated', { length: conclusion.content.length });
      return conclusion.content;
    } catch (error: any) {
      this.logger.error('Error generating conclusion', { error: error.message });
      throw new ResearchAnalystException('Failed to generate conclusion', error);
    }
  }

  // ----------------------------------------------------------------------
  // Finalize report
  // ----------------------------------------------------------------------
  async finalizeReport(content: string, introduction: string, conclusion: string): Promise<string> {
    try {
      this.logger.info('Finalizing report compilation');
      
      if (content.startsWith('## Insights')) {
        content = content.replace('## Insights', '').trim();
      }

      let sources = null;
      if (content.includes('## Sources')) {
        const parts = content.split('\n## Sources\n');
        if (parts.length === 2) {
          content = parts[0];
          sources = parts[1];
        }
      }

      let finalReport = '';
      if (introduction) {
        finalReport += introduction + '\n\n---\n\n';
      }
      finalReport += content;
      if (conclusion) {
        finalReport += '\n\n---\n\n' + conclusion;
      }
      if (sources) {
        finalReport += '\n\n## Sources\n' + sources;
      }

      this.logger.info('Report finalized');
      return finalReport;
    } catch (error: any) {
      this.logger.error('Error finalizing report', { error: error.message });
      throw new ResearchAnalystException('Failed to finalize report', error);
    }
  }

  // ----------------------------------------------------------------------
  // Save report to file
  // ----------------------------------------------------------------------
  async saveReport(finalReport: string, topic: string, format: 'docx' | 'pdf' = 'docx'): Promise<string> {
    try {
      this.logger.info('Saving report', { topic, format });
      
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '_')
        .replace('T', '_')
        .split('.')[0];
      
      const safeTopic = topic.replace(/[\\/*?:"<>|]/g, '_');
      const baseName = `${safeTopic.replace(/ /g, '_')}_${timestamp}`;

      // Root folder
      const projectRoot = path.resolve(__dirname, '../..');
      const rootDir = path.join(projectRoot, 'generated_report');
      
      // Create subfolder for this report
      const reportFolder = path.join(rootDir, baseName);
      if (!fs.existsSync(reportFolder)) {
        fs.mkdirSync(reportFolder, { recursive: true });
      }

      // Final file path
      const filePath = path.join(reportFolder, `${baseName}.${format}`);

      if (format === 'docx') {
        await this.saveAsDocx(finalReport, filePath);
      } else if (format === 'pdf') {
        await this.saveAsPdf(finalReport, filePath);
      } else {
        throw new Error("Invalid format. Use 'docx' or 'pdf'.");
      }

      this.logger.info('Report saved successfully', { path: filePath });
      return filePath;
    } catch (error: any) {
      this.logger.error('Error saving report', { error: error.message });
      throw new ResearchAnalystException('Failed to save report file', error);
    }
  }

  // ----------------------------------------------------------------------
  // Save as DOCX
  // ----------------------------------------------------------------------
  private async saveAsDocx(text: string, filePath: string): Promise<void> {
    try {
      const paragraphs = text.split('\n').filter(line => line.trim() !== '');
      const docParagraphs: Paragraph[] = [];

      for (const line of paragraphs) {
        if (line.startsWith('# ')) {
          docParagraphs.push(new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1
          }));
        } else if (line.startsWith('## ')) {
          docParagraphs.push(new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2
          }));
        } else if (line.startsWith('### ')) {
          docParagraphs.push(new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3
          }));
        } else {
          docParagraphs.push(new Paragraph({
            children: [new TextRun(line)]
          }));
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: docParagraphs
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
    } catch (error: any) {
      this.logger.error('DOCX save failed', { path: filePath, error: error.message });
      throw new ResearchAnalystException('Error saving DOCX report', error);
    }
  }

  // ----------------------------------------------------------------------
  // Save as PDF
  // ----------------------------------------------------------------------
  private async saveAsPdf(text: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'letter',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const lines = text.split('\n');
        let y = 50;
        const lineHeight = 15;
        const pageHeight = 792; // Letter size height in points
        const bottomMargin = 50;

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            y += lineHeight;
            continue;
          }

          // Check if we need a new page
          if (y > pageHeight - bottomMargin) {
            doc.addPage();
            y = 50;
          }

          // Set font based on heading
          if (line.startsWith('# ')) {
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text(line.substring(2), 50, y);
            y += lineHeight * 1.5;
          } else if (line.startsWith('## ')) {
            doc.fontSize(13).font('Helvetica-Bold');
            doc.text(line.substring(3), 50, y);
            y += lineHeight * 1.3;
          } else if (line.startsWith('### ')) {
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text(line.substring(4), 50, y);
            y += lineHeight * 1.2;
          } else {
            doc.fontSize(11).font('Helvetica');
            // Handle text wrapping
            const textWidth = doc.widthOfString(line);
            if (textWidth > 500) { // Assuming 500pt width for content area
              // Simple wrapping
              const words = line.split(' ');
              let currentLine = '';
              for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (doc.widthOfString(testLine) > 500) {
                  doc.text(currentLine, 50, y);
                  y += lineHeight;
                  currentLine = word;
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine) {
                doc.text(currentLine, 50, y);
                y += lineHeight;
              }
            } else {
              doc.text(line, 50, y);
              y += lineHeight;
            }
          }

          // Reset font
          doc.fontSize(11).font('Helvetica');
        }

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error: any) {
        this.logger.error('PDF save failed', { path: filePath, error: error.message });
        reject(new ResearchAnalystException('Error saving PDF report', error));
      }
    });
  }

  // ----------------------------------------------------------------------
  // Simplified workflow execution
  // ----------------------------------------------------------------------
  async executeWorkflow(topic: string, maxAnalysts: number = 3, feedback?: string): Promise<{
    thread_id: string;
    analysts: Analyst[];
    sections: string[];
    final_report: string;
  }> {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Step 1: Create analysts - Fixed to use correct parameter type
      const analysts = await this.createAnalysts({
        topic,
        max_analysts: maxAnalysts,
        human_analyst_feedback: feedback || ''
      });

      // Step 2: For now, create mock sections (in real app, run interviews)
      const sections = analysts.map(analyst => 
        `## Section: ${analyst.name}\nAnalysis from ${analyst.role} at ${analyst.affiliation}.\n\n${analyst.description}\n\nMock interview content would go here.`
      );

      // Step 3: Write report
      const content = await this.writeReport(sections, topic);
      const introduction = await this.writeIntroduction(sections, topic);
      const conclusion = await this.writeConclusion(sections, topic);
      const finalReport = await this.finalizeReport(content, introduction, conclusion);

      return {
        thread_id: threadId,
        analysts,
        sections,
        final_report: finalReport
      };
    } catch (error: any) {
      this.logger.error('Error in workflow execution', { error: error.message });
      throw new ResearchAnalystException('Workflow execution failed', error);
    }
  }
}