import { StateGraph } from '@langgraph/sdk';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PromptTemplates } from '../prompts/promptTemplates';
import { Logger } from '../utils/logger';
import { ResearchAnalystException } from '../utils/exceptions';
import { 
  InterviewState, 
  Analyst,
  SearchQuery 
} from '../models/schemas';

export class InterviewGraphBuilder {
  private llm: any;
  private tavilySearch: any;
  private memory: Map<string, any>;
  private logger: Logger;

  constructor(llm: any, tavilySearch: any) {
    this.llm = llm;
    this.tavilySearch = tavilySearch;
    this.memory = new Map();
    this.logger = new Logger('InterviewGraphBuilder');
  }

  // ----------------------------------------------------------------------
  // 🔹 Step 1: Analyst generates question
  // ----------------------------------------------------------------------
  private async generateQuestion(state: InterviewState): Promise<Partial<InterviewState>> {
    const analyst = state.analyst;
    const messages = state.messages;

    try {
      this.logger.info('Generating analyst question', { analyst: analyst.name });
      const systemPrompt = PromptTemplates.ANALYST_ASK_QUESTIONS(analyst.persona || '');
      const question = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        ...messages
      ]);
      
      this.logger.info('Question generated successfully', { 
        question_preview: question.content.substring(0, 200) 
      });
      
      return { messages: [question] };
    } catch (error: any) {
      this.logger.error('Error generating analyst question', { error: error.message });
      throw new ResearchAnalystException('Failed to generate analyst question', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Step 2: Perform web search
  // ----------------------------------------------------------------------
  private async searchWeb(state: InterviewState): Promise<Partial<InterviewState>> {
    try {
      this.logger.info('Generating search query from conversation');
      
      // Generate search query using structured output
      const searchPrompt = PromptTemplates.GENERATE_SEARCH_QUERY();
      const searchQueryResponse = await this.llm.invoke([
        new SystemMessage({ content: searchPrompt }),
        ...state.messages
      ]);
      
      // Extract search query from response
      const searchQuery = searchQueryResponse.content;
      this.logger.info('Performing Tavily web search', { query: searchQuery });
      
      const searchDocs = await this.tavilySearch.invoke(searchQuery);
      
      if (!searchDocs || searchDocs.length === 0) {
        this.logger.warning('No search results found');
        return { context: ['[No search results found.]'] };
      }

      const formatted = searchDocs.map((doc: any) => 
        `<Document href="${doc.url || '#'}"/>\n${doc.content || ''}\n</Document>`
      ).join('\n\n---\n\n');
      
      this.logger.info('Web search completed', { result_count: searchDocs.length });
      return { context: [formatted] };
    } catch (error: any) {
      this.logger.error('Error during web search', { error: error.message });
      throw new ResearchAnalystException('Failed during web search execution', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Step 3: Expert generates answers
  // ----------------------------------------------------------------------
  private async generateAnswer(state: InterviewState): Promise<Partial<InterviewState>> {
    const analyst = state.analyst;
    const messages = state.messages;
    const context = state.context?.join('\n') || '[No context available.]';

    try {
      this.logger.info('Generating expert answer', { analyst: analyst.name });
      const systemPrompt = PromptTemplates.GENERATE_ANSWERS(analyst.persona || '', context);
      const answer = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        ...messages
      ]);
      
      // In TypeScript/JS, we can't directly assign to answer.name
      // We'll store the role differently
      const expertAnswer = {
        ...answer,
        role: 'expert'
      };
      
      this.logger.info('Expert answer generated successfully', { 
        preview: answer.content.substring(0, 200) 
      });
      
      return { messages: [expertAnswer] };
    } catch (error: any) {
      this.logger.error('Error generating expert answer', { error: error.message });
      throw new ResearchAnalystException('Failed to generate expert answer', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Step 4: Save interview transcript
  // ----------------------------------------------------------------------
  private async saveInterview(state: InterviewState): Promise<Partial<InterviewState>> {
    try {
      const messages = state.messages;
      const interview = messages.map(msg => 
        `${msg.role || 'unknown'}: ${msg.content}`
      ).join('\n');
      
      this.logger.info('Interview transcript saved', { message_count: messages.length });
      return { interview };
    } catch (error: any) {
      this.logger.error('Error saving interview transcript', { error: error.message });
      throw new ResearchAnalystException('Failed to save interview transcript', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Step 5: Write report section from interview context
  // ----------------------------------------------------------------------
  private async writeSection(state: InterviewState): Promise<Partial<InterviewState>> {
    const context = state.context?.join('\n') || '[No context available.]';
    const analyst = state.analyst;

    try {
      this.logger.info('Generating report section', { analyst: analyst.name });
      const systemPrompt = PromptTemplates.WRITE_SECTION(analyst.description);
      const section = await this.llm.invoke([
        new SystemMessage({ content: systemPrompt }),
        new HumanMessage({ content: `Use this source to write your section: ${context}` })
      ]);
      
      this.logger.info('Report section generated successfully', { 
        length: section.content.length 
      });
      
      return { sections: [section.content] };
    } catch (error: any) {
      this.logger.error('Error writing report section', { error: error.message });
      throw new ResearchAnalystException('Failed to generate report section', error);
    }
  }

  // ----------------------------------------------------------------------
  // 🔹 Build Graph
  // ----------------------------------------------------------------------
  async build() {
    try {
      this.logger.info('Building Interview Graph workflow');
      
      // Create workflow builder
      const builder = new StateGraph<InterviewState>({
        schema: {
          messages: { type: 'array', default: [] },
          max_num_turns: { type: 'number', default: 2 },
          context: { type: 'array', default: [] },
          analyst: { type: 'object' },
          interview: { type: 'string', default: '' },
          sections: { type: 'array', default: [] }
        }
      });

      // Add nodes
      builder.addNode('ask_question', this.generateQuestion.bind(this));
      builder.addNode('search_web', this.searchWeb.bind(this));
      builder.addNode('generate_answer', this.generateAnswer.bind(this));
      builder.addNode('save_interview', this.saveInterview.bind(this));
      builder.addNode('write_section', this.writeSection.bind(this));

      // Add edges
      builder.setEntryPoint('ask_question');
      builder.addEdge('ask_question', 'search_web');
      builder.addEdge('search_web', 'generate_answer');
      builder.addEdge('generate_answer', 'save_interview');
      builder.addEdge('save_interview', 'write_section');
      builder.setFinishPoint('write_section');

      const graph = builder.compile();
      this.logger.info('Interview Graph compiled successfully');
      
      return graph;
    } catch (error: any) {
      this.logger.error('Error building interview graph', { error: error.message });
      throw new ResearchAnalystException('Failed to build interview graph workflow', error);
    }
  }
}