import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';

// -------------------------------
// Section Model
// -------------------------------
export interface Section {
  title: string;
  content: string;
}

// -------------------------------
// Analyst Models
// -------------------------------
export interface Analyst {
  affiliation: string;
  name: string;
  role: string;
  description: string;
}

export class AnalystModel implements Analyst {
  constructor(
    public affiliation: string,
    public name: string,
    public role: string,
    public description: string
  ) {}

  get persona(): string {
    return (
      `Name: ${this.name}\n` +
      `Role: ${this.role}\n` +
      `Affiliation: ${this.affiliation}\n` +
      `Description: ${this.description}\n`
    );
  }
}

export interface Perspectives {
  analysts: Analyst[];
}

// -------------------------------
// Search Query Model
// -------------------------------
export interface SearchQuery {
  search_query: string;
}

// -------------------------------
// State Types for Graphs
// -------------------------------
export interface GenerateAnalystsInput {
  topic: string;
  max_analysts: number;
  human_analyst_feedback: string;
}

export interface GenerateAnalystsState extends GenerateAnalystsInput {
  analysts: Analyst[];
}

export interface InterviewState {
  messages: BaseMessage[];
  max_num_turns: number;
  context: string[];
  analyst: Analyst;
  interview: string;
  sections: string[];
}

export interface ResearchGraphState {
  topic: string;
  max_analysts: number;
  human_analyst_feedback: string;
  analysts: Analyst[];
  sections: string[];
  introduction: string;
  content: string;
  conclusion: string;
  final_report: string;
}

// Zod Schemas for validation
export const AnalystSchema = z.object({
  affiliation: z.string().describe("Primary affiliation of the analyst."),
  name: z.string().describe("Name of the analyst."),
  role: z.string().describe("Role of the analyst in the context of the topic."),
  description: z.string().describe("Description of the analyst's focus, concerns, and motives.")
});

export const PerspectivesSchema = z.object({
  analysts: z.array(AnalystSchema).describe("Comprehensive list of analysts with their roles and affiliations.")
});

export const SearchQuerySchema = z.object({
  search_query: z.string().optional().describe("Search query for retrieval.")
});

export const GenerateAnalystsInputSchema = z.object({
  topic: z.string(),
  max_analysts: z.number(),
  human_analyst_feedback: z.string()
});

export const GenerateAnalystsStateSchema = z.object({
  topic: z.string(),
  max_analysts: z.number(),
  human_analyst_feedback: z.string(),
  analysts: z.array(AnalystSchema)
});

export const InterviewStateSchema = z.object({
  messages: z.array(z.any()),
  max_num_turns: z.number(),
  context: z.array(z.string()),
  analyst: AnalystSchema,
  interview: z.string(),
  sections: z.array(z.string())
});